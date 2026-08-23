import {
  JOB_MATCH_PROMPT_VERSION,
  JOB_MATCH_RESPONSE_SCHEMA,
  JOB_MATCH_SYSTEM_PROMPT,
  type JobMatchResponse,
  buildJobMatchPrompt,
  jobMatchResponseSchema,
} from '@cv-jobs-compatibility/prompt-schemas'
import { Inject, Injectable, Logger } from '@nestjs/common'
import { and, asc, eq, notInArray } from 'drizzle-orm'
import { DRIZZLE } from '../../database/database.constants'
import type { Database } from '../../database/database.module'
import {
  type JobMatchRow,
  type JobRequirementRow,
  type JobSkillRow,
  jobMatchRequirements,
  jobMatchSkills,
  jobMatches,
  jobRequirements,
  jobSkills,
  jobs,
  resumeEducation,
  resumeExperiences,
  resumeProjects,
  resumeSkills,
  resumes,
} from '../../database/schema'
import { GeminiService, MalformedModelResponseError } from '../../gemini/gemini.service'
import { TerminalIngestionError } from '../../pipeline/terminal-ingestion-error'
import { toMatchJobInput, toMatchResumeInput } from './match-inputs'
import { meetsYearsRequirement, scoreMatch, verdictFor } from './match-scoring'

/** Statuses a match never leaves. */
const TERMINAL = ['ready', 'failed'] as const

/**
 * One CV graded against one posting.
 *
 * The model judges each row; this turns those judgements into rows of our own
 * and computes the score from them. Nothing here asks a model how good a match
 * is - that number is arithmetic over what it said, which is what makes the
 * weighting free to change later without paying for a single call again.
 */
@Injectable()
export class JobMatchService {
  private readonly logger = new Logger(JobMatchService.name)

  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly gemini: GeminiService,
  ) {}

  /** Called when the queue gives up. */
  async abandon(matchId: string, detail: string): Promise<void> {
    this.logger.error(`Match ${matchId} abandoned after the last retry: ${detail}`)

    await this.fail(matchId, 'internal_error')
  }

  async run(matchId: string): Promise<void> {
    const match = await this.claim(matchId)
    if (!match) return

    try {
      const [job, requirements, skills, resume] = await Promise.all([
        this.loadJob(match.jobId),
        this.loadRequirements(match.jobId),
        this.loadSkills(match.jobId),
        this.loadResume(match.resumeId),
      ])

      if (requirements.length === 0 && skills.length === 0) {
        throw new TerminalIngestionError('The posting has nothing to grade against', 'nothing_to_grade')
      }

      this.logger.log(
        `Grading ${resume.experiences.length} roles against ${requirements.length} requirements ` +
          `and ${skills.length} skills for match ${matchId}`,
      )

      const response = await this.ask(
        buildJobMatchPrompt({
          resume: toMatchResumeInput(resume),
          job: toMatchJobInput(job, requirements, skills),
        }),
      )

      this.logger.log(
        `Model answered for match ${matchId} in ${response.latencyMs}ms ` +
          `(${response.inputTokens ?? '?'} in, ${response.outputTokens ?? '?'} out)`,
      )
      this.logger.debug(JSON.stringify(response.data, null, 2))

      const parsed = this.parse(response.data)

      await this.persist(match, { job, requirements, skills, resume }, parsed, response)
    } catch (error) {
      if (!(error instanceof TerminalIngestionError)) throw error

      this.logger.warn(`Match ${matchId} failed: ${error.detail}`)
      await this.fail(matchId, error.code)
    }
  }

  /**
   * A redelivered job for a match that already finished does nothing, the same
   * way the other two pipelines claim their rows.
   */
  private async claim(matchId: string): Promise<JobMatchRow | null> {
    const [claimed] = await this.db
      .update(jobMatches)
      .set({ status: 'analyzing' })
      .where(and(eq(jobMatches.id, matchId), notInArray(jobMatches.status, [...TERMINAL])))
      .returning()

    if (claimed) return claimed

    this.logger.warn(`Match ${matchId} is already finished or gone, dropping the job`)

    return null
  }

  private async ask(prompt: string) {
    try {
      return await this.gemini.generateJson({
        systemPrompt: JOB_MATCH_SYSTEM_PROMPT,
        prompt,
        responseSchema: JOB_MATCH_RESPONSE_SCHEMA,
        // Grading, not writing. The same CV against the same posting should
        // come back the same twice.
        temperature: 0,
      })
    } catch (error) {
      if (error instanceof MalformedModelResponseError) {
        throw new TerminalIngestionError('The model did not return usable JSON', 'malformed_response')
      }

      throw error
    }
  }

  private parse(data: unknown): JobMatchResponse {
    const result = jobMatchResponseSchema.safeParse(data)

    if (!result.success) {
      throw new TerminalIngestionError(
        `Response did not match the schema: ${result.error.message}`,
        'malformed_response',
      )
    }

    return result.data
  }

  /**
   * The judgements, then the arithmetic over them, in one transaction.
   *
   * A row the model skipped is graded at its worst rather than dropped. Dropping
   * it would quietly shrink the denominator, so a match the model half-answered
   * would score higher than one it answered fully - a bug that makes a candidate
   * look better the less carefully they were read.
   */
  private async persist(
    match: JobMatchRow,
    documents: {
      job: Awaited<ReturnType<JobMatchService['loadJob']>>
      requirements: JobRequirementRow[]
      skills: JobSkillRow[]
      resume: Awaited<ReturnType<JobMatchService['loadResume']>>
    },
    parsed: JobMatchResponse,
    response: {
      model: string
      inputTokens: number | null
      outputTokens: number | null
      latencyMs: number
      data: unknown
    },
  ): Promise<void> {
    const byRequirement = new Map(parsed.requirements.map((one) => [one.index, one]))
    const bySkill = new Map(parsed.skills.map((one) => [one.index, one]))

    const missing =
      documents.requirements.filter((_, index) => !byRequirement.has(index + 1)).length +
      documents.skills.filter((_, index) => !bySkill.has(index + 1)).length

    if (missing > 0) {
      this.logger.warn(`Model skipped ${missing} rows on match ${match.id}; grading them as unmet`)
    }

    const gradedRequirements = documents.requirements.map((row, index) => ({
      row,
      stars: byRequirement.get(index + 1)?.stars ?? 1,
      evidence: byRequirement.get(index + 1)?.evidence ?? null,
    }))

    const gradedSkills = documents.skills.map((row, index) => ({
      row,
      verdict: bySkill.get(index + 1)?.verdict ?? 'no',
      gapType: bySkill.get(index + 1)?.gapType ?? null,
      evidence: bySkill.get(index + 1)?.evidence ?? null,
    }))

    const score = scoreMatch(
      gradedRequirements.map(({ row, stars }) => ({ importance: row.importance, stars })),
      gradedSkills.map(({ row, verdict }) => ({ importance: row.importance, verdict })),
    )

    const resumeYears =
      documents.resume.resume.yearsExperienceTotal === null
        ? null
        : Number(documents.resume.resume.yearsExperienceTotal)
    const jobYears =
      documents.job.yearsExperienceMin === null ? null : Number(documents.job.yearsExperienceMin)

    await this.db.transaction(async (tx) => {
      await tx.delete(jobMatchRequirements).where(eq(jobMatchRequirements.matchId, match.id))
      await tx.delete(jobMatchSkills).where(eq(jobMatchSkills.matchId, match.id))

      if (gradedRequirements.length > 0) {
        await tx.insert(jobMatchRequirements).values(
          gradedRequirements.map(({ row, stars, evidence }) => ({
            matchId: match.id,
            requirementId: row.id,
            stars,
            evidence,
          })),
        )
      }

      if (gradedSkills.length > 0) {
        await tx.insert(jobMatchSkills).values(
          gradedSkills.map(({ row, verdict, gapType, evidence }) => ({
            matchId: match.id,
            skillId: row.id,
            verdict,
            // Only meaningful on a miss; a `yes` with a gap type is a
            // contradiction, so it is dropped rather than stored.
            gapType: verdict === 'yes' ? null : gapType,
            evidence,
          })),
        )
      }

      await tx
        .update(jobMatches)
        .set({
          status: 'ready',
          failureReason: null,
          score,
          // Derived, never asked for - so the badge cannot contradict the
          // number printed next to it.
          verdict: score === null ? null : verdictFor(score),
          recommendation: parsed.recommendation,
          meetsYearsRequirement: meetsYearsRequirement(resumeYears, jobYears),
          essentials: parsed.essentials,
          summary: parsed.summary,
          strengths: parsed.strengths,
          gaps: parsed.gaps,
          tailoredQuestions: parsed.tailoredQuestions,
          model: response.model,
          promptVersion: JOB_MATCH_PROMPT_VERSION,
          rawResponse: response.data as object,
          inputTokens: response.inputTokens,
          outputTokens: response.outputTokens,
          latencyMs: response.latencyMs,
          completedAt: new Date(),
        })
        .where(eq(jobMatches.id, match.id))
    })

    this.logger.log(
      `Match ${match.id} scored ${score ?? '-'} (${score === null ? 'no verdict' : verdictFor(score)}), ` +
        `recommendation ${parsed.recommendation}`,
    )
  }

  private async fail(matchId: string, code: string): Promise<void> {
    await this.db
      .update(jobMatches)
      .set({ status: 'failed', failureReason: code, completedAt: new Date() })
      .where(eq(jobMatches.id, matchId))
  }

  private async loadJob(jobId: string) {
    const [job] = await this.db.select().from(jobs).where(eq(jobs.id, jobId)).limit(1)

    if (!job) throw new TerminalIngestionError('The posting is gone', 'missing_job')

    return job
  }

  private loadRequirements(jobId: string): Promise<JobRequirementRow[]> {
    return this.db
      .select()
      .from(jobRequirements)
      .where(eq(jobRequirements.jobId, jobId))
      .orderBy(asc(jobRequirements.orderIndex))
  }

  private loadSkills(jobId: string): Promise<JobSkillRow[]> {
    return this.db
      .select()
      .from(jobSkills)
      .where(eq(jobSkills.jobId, jobId))
      .orderBy(asc(jobSkills.orderIndex))
  }

  private async loadResume(resumeId: string) {
    const [resume] = await this.db.select().from(resumes).where(eq(resumes.id, resumeId)).limit(1)

    if (!resume) throw new TerminalIngestionError('The CV is gone', 'missing_resume')

    const [experiences, education, skills, projects] = await Promise.all([
      this.db
        .select()
        .from(resumeExperiences)
        .where(eq(resumeExperiences.resumeId, resumeId))
        .orderBy(asc(resumeExperiences.orderIndex)),
      this.db
        .select()
        .from(resumeEducation)
        .where(eq(resumeEducation.resumeId, resumeId))
        .orderBy(asc(resumeEducation.orderIndex)),
      this.db
        .select()
        .from(resumeSkills)
        .where(eq(resumeSkills.resumeId, resumeId))
        .orderBy(asc(resumeSkills.orderIndex)),
      this.db
        .select()
        .from(resumeProjects)
        .where(eq(resumeProjects.resumeId, resumeId))
        .orderBy(asc(resumeProjects.orderIndex)),
    ])

    return { resume, experiences, education, skills, projects }
  }
}
