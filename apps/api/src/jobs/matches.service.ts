import type { JobMatchModel, JobMatchSummaryModel } from '@cv-jobs-compatibility/types'
import { ConflictException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common'
import { and, asc, eq, sql } from 'drizzle-orm'
import { PgBoss, fromDrizzle } from 'pg-boss'
import { DRIZZLE } from '../database/database.constants'
import type { Database } from '../database/database.module'
import {
  type JobMatchRow,
  jobMatchRequirements,
  jobMatchSkills,
  jobMatches,
  jobRequirements,
  jobSkills,
  jobs,
  resumes,
  savedJobs,
} from '../database/schema'
import { JOB_MATCH_JOB_OPTIONS, PG_BOSS, QUEUES } from '../queue/queue.constants'
import { TelemetryService } from '../telemetry/telemetry.service'
import { toJobMatchModel, toJobMatchSummaryModel } from './match.mapper'

/**
 * Scoring a posting against the caller's CV.
 *
 * Kept apart from `JobsService` because the two answer different questions:
 * that one is about postings, this one is about the comparison between a
 * posting and a CV. They meet only through `job_matches`.
 *
 * A match is keyed on the resume, not the account. That is what makes staleness
 * impossible rather than something to remember: a new CV is a new id, so no
 * match exists for it and the score is simply absent until somebody asks for a
 * new one.
 */
@Injectable()
export class MatchesService {
  private readonly logger = new Logger(MatchesService.name)

  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    @Inject(PG_BOSS) private readonly boss: PgBoss,
    private readonly telemetry: TelemetryService,
  ) {}

  /**
   * Queues a scoring run, or hands back the one already in flight.
   *
   * Gated on the posting being read and its briefing having settled - succeeded
   * or failed, either way. The briefing is not an input to scoring, so requiring
   * it to have *worked* would let a permanently failing one block scoring
   * forever; requiring only that it is no longer pending keeps the three calls
   * from running over each other without creating a dead end.
   */
  async create(userId: string, jobId: string): Promise<JobMatchSummaryModel> {
    const job = await this.findSavedJob(userId, jobId)
    if (!job) throw new NotFoundException('No such posting')

    if (job.status !== 'ready') {
      throw new ConflictException('This posting has not been read yet.')
    }

    if (job.insightsStatus === 'pending') {
      throw new ConflictException('Still working out what to expect from this role. Try again shortly.')
    }

    const resumeId = await this.findResumeId(userId)

    const existing = await this.find(resumeId, jobId)
    // Somebody pressing the button twice is somebody impatient, not somebody
    // asking for a second opinion.
    if (existing && existing.status !== 'ready' && existing.status !== 'failed') {
      return toJobMatchSummaryModel(existing)
    }

    const match = await this.db.transaction(async (tx) => {
      // Re-running replaces: the row is reset to queued and its judgements are
      // cleared, so a half-old half-new report can never be read.
      const [row] = await tx
        .insert(jobMatches)
        .values({ jobId, resumeId, status: 'queued' })
        .onConflictDoUpdate({
          target: [jobMatches.jobId, jobMatches.resumeId],
          set: {
            status: 'queued',
            failureReason: null,
            score: null,
            verdict: null,
            recommendation: null,
            summary: null,
            completedAt: null,
          },
        })
        .returning()

      await tx.delete(jobMatchRequirements).where(eq(jobMatchRequirements.matchId, row.id))
      await tx.delete(jobMatchSkills).where(eq(jobMatchSkills.matchId, row.id))

      await this.boss.send(
        QUEUES.jobMatch,
        { matchId: row.id, ...this.telemetry.carrier() },
        { ...JOB_MATCH_JOB_OPTIONS, db: fromDrizzle(tx, sql) },
      )

      return row
    })

    this.logger.log(`Queued match ${match.id} for posting ${jobId}`)

    return toJobMatchSummaryModel(match)
  }

  /** The whole report. `404` until the posting has been scored. */
  async findOne(userId: string, jobId: string): Promise<JobMatchModel> {
    const job = await this.findSavedJob(userId, jobId)
    if (!job) throw new NotFoundException('No such posting')

    const resumeId = await this.findResumeId(userId)

    const match = await this.find(resumeId, jobId)
    if (!match) throw new NotFoundException('This posting has not been scored yet')

    // Each judgement joined to the row it was made about, in the posting's own
    // order - so the report reads down the advert rather than in whatever order
    // the model answered.
    const [requirements, skills] = await Promise.all([
      this.db
        .select({ judgement: jobMatchRequirements, requirement: jobRequirements })
        .from(jobMatchRequirements)
        .innerJoin(jobRequirements, eq(jobRequirements.id, jobMatchRequirements.requirementId))
        .where(eq(jobMatchRequirements.matchId, match.id))
        .orderBy(asc(jobRequirements.orderIndex)),
      this.db
        .select({ judgement: jobMatchSkills, skill: jobSkills })
        .from(jobMatchSkills)
        .innerJoin(jobSkills, eq(jobSkills.id, jobMatchSkills.skillId))
        .where(eq(jobMatchSkills.matchId, match.id))
        .orderBy(asc(jobSkills.orderIndex)),
    ])

    return toJobMatchModel({ match, requirements, skills })
  }

  /**
   * The caller's CV.
   *
   * A `409` rather than a `404`: the account has no CV, which is a state the
   * app routes around long before anyone reaches a posting, so arriving here
   * means something upstream went wrong.
   */
  private async findResumeId(userId: string): Promise<string> {
    const [resume] = await this.db
      .select({ id: resumes.id })
      .from(resumes)
      .where(eq(resumes.userId, userId))
      .limit(1)

    if (!resume) throw new ConflictException('There is no CV to score this against.')

    return resume.id
  }

  private async find(resumeId: string, jobId: string): Promise<JobMatchRow | undefined> {
    const [row] = await this.db
      .select()
      .from(jobMatches)
      .where(and(eq(jobMatches.resumeId, resumeId), eq(jobMatches.jobId, jobId)))
      .limit(1)

    return row
  }

  /** Reached only through `saved_jobs`, so an id nobody saved does not exist. */
  private async findSavedJob(userId: string, jobId: string) {
    const [row] = await this.db
      .select({ status: jobs.status, insightsStatus: jobs.insightsStatus })
      .from(savedJobs)
      .innerJoin(jobs, eq(jobs.id, savedJobs.jobId))
      .where(and(eq(savedJobs.userId, userId), eq(savedJobs.jobId, jobId)))
      .limit(1)

    return row
  }
}
