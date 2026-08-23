import {
  JOB_INSIGHTS_OFFLINE_PROMPT_VERSION,
  JOB_INSIGHTS_OFFLINE_SYSTEM_PROMPT,
  JOB_INSIGHTS_PROMPT_VERSION,
  JOB_INSIGHTS_RESPONSE_SCHEMA,
  JOB_INSIGHTS_SYSTEM_PROMPT,
  type JobInsightsResponse,
  buildJobInsightsPrompt,
  jobInsightsResponseSchema,
} from '@cv-jobs-compatibility/prompt-schemas'
import { Inject, Injectable, Logger } from '@nestjs/common'
import { eq } from 'drizzle-orm'
import { BaseConfigService } from '../../config/config.service'
import { DRIZZLE } from '../../database/database.constants'
import type { Database } from '../../database/database.module'
import { jobFlags, jobInsights, jobTexts, jobs } from '../../database/schema'
import { GeminiService, MalformedModelResponseError } from '../../gemini/gemini.service'
import { TerminalIngestionError } from '../../pipeline/terminal-ingestion-error'

/**
 * The briefing: what to know about this employer and this process before
 * applying.
 *
 * A separate call from extraction because the two prompts contradict each
 * other - one copies and never infers, the other reasons past the document and
 * searches the web - and a separate queue because they fail differently. A
 * posting whose briefing never arrives is still fully parsed and fully
 * scoreable, so nothing here may hold a posting back.
 *
 * This is the second and last place the pasted advert enters a prompt. Flags
 * quote the lines they were read from, which needs the text; everything after
 * ingestion works from the structured rows.
 */
@Injectable()
export class JobInsightsService {
  private readonly logger = new Logger(JobInsightsService.name)

  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly gemini: GeminiService,
    private readonly config: BaseConfigService,
  ) {}

  /** Called when the queue gives up. A posting without a briefing is fine. */
  async abandon(jobId: string, detail: string): Promise<void> {
    this.logger.error(`Insights for posting ${jobId} abandoned: ${detail}`)

    await this.db.update(jobs).set({ insightsStatus: 'failed' }).where(eq(jobs.id, jobId))
  }

  async brief(jobId: string): Promise<void> {
    const job = await this.claim(jobId)
    if (!job) return

    try {
      const text = await this.loadText(jobId)

      this.logger.log(
        `Briefing posting ${jobId}: ${job.title ?? 'untitled'} at ${job.company ?? 'an unnamed company'}` +
          `${this.grounded ? '' : ' (advert only - web search is off)'}`,
      )

      const response = await this.ask(text, job.company, job.title)

      this.logger.log(
        `Model answered for posting ${jobId} in ${response.latencyMs}ms ` +
          `(${response.inputTokens ?? '?'} in, ${response.outputTokens ?? '?'} out)`,
      )
      this.logger.debug(JSON.stringify(response.data, null, 2))

      const parsed = this.parse(response.data)

      await this.persist(jobId, parsed, response)

      this.logger.log(
        `Briefed posting ${jobId}: company ${parsed.company.known ? 'found' : 'not found'}, ` +
          `${parsed.flags.length} flags (${parsed.flags.filter((one) => one.source.kind === 'web').length} from the web), ` +
          `${parsed.interviewStages.length} interview stages (${parsed.interviewBasis}), ` +
          `${parsed.interviewQuestions.length} questions`,
      )
    } catch (error) {
      // Same distinction as extraction: what a retry could survive propagates
      // and reaches pg-boss, what would repeat identically stops here.
      if (!(error instanceof TerminalIngestionError)) throw error

      this.logger.warn(`Insights for posting ${jobId} failed: ${error.detail}`)
      await this.db.update(jobs).set({ insightsStatus: 'failed' }).where(eq(jobs.id, jobId))
    }
  }

  /**
   * A briefing is only worth writing for a posting that parsed, and only once.
   *
   * Unlike extraction there is no status to claim atomically - `insightsStatus`
   * has no in-progress state, because nothing branches on the difference
   * between queued and running. A redelivered job therefore re-runs and
   * overwrites, which is acceptable: the row is replaced wholesale anyway.
   */
  private async claim(jobId: string) {
    const [job] = await this.db.select().from(jobs).where(eq(jobs.id, jobId)).limit(1)

    if (!job) {
      this.logger.warn(`Posting ${jobId} no longer exists, dropping the briefing`)
      return null
    }

    if (job.status !== 'ready') {
      this.logger.warn(`Posting ${jobId} is ${job.status}, not briefing it`)
      return null
    }

    return job
  }

  /**
   * Whether this process may look the employer up.
   *
   * `googleSearch` is refused outright on a project without billing, so this is
   * off unless someone has said otherwise. The prompt changes with it rather
   * than just the request flag: telling a model it has search when it has none
   * is how you get invented reviews with plausible names and dates attached.
   */
  private get grounded(): boolean {
    return this.config.geminiSearchEnabled
  }

  private async ask(text: string, company: string | null, title: string | null) {
    try {
      return await this.gemini.generateJson({
        systemPrompt: this.grounded
          ? JOB_INSIGHTS_SYSTEM_PROMPT
          : JOB_INSIGHTS_OFFLINE_SYSTEM_PROMPT,
        prompt: buildJobInsightsPrompt({ documentText: text, company, title }),
        responseSchema: JOB_INSIGHTS_RESPONSE_SCHEMA,
        searchTheWeb: this.grounded,
        // Not extraction. A briefing that reasons needs a little room.
        temperature: 0.3,
      })
    } catch (error) {
      // Unparseable output would come back unparseable again; a rate limit or a
      // timeout would not, so those propagate and get retried.
      if (error instanceof MalformedModelResponseError) {
        throw new TerminalIngestionError('The model did not return usable JSON', 'malformed_response')
      }

      throw error
    }
  }

  private async loadText(jobId: string): Promise<string> {
    const [row] = await this.db
      .select({ content: jobTexts.content })
      .from(jobTexts)
      .where(eq(jobTexts.jobId, jobId))
      .limit(1)

    if (!row) throw new TerminalIngestionError('The posting has no stored text', 'missing_text')

    return row.content
  }

  private parse(data: unknown): JobInsightsResponse {
    const result = jobInsightsResponseSchema.safeParse(data)

    if (!result.success) {
      throw new TerminalIngestionError(
        `Response did not match the schema: ${result.error.message}`,
        'malformed_response',
      )
    }

    return result.data
  }

  /**
   * The briefing and its flags, replaced wholesale.
   *
   * A flag with no attribution is dropped here as well as forbidden in the
   * prompt. The instruction is what usually works; this is what makes it true.
   */
  private async persist(
    jobId: string,
    parsed: JobInsightsResponse,
    response: { model: string; inputTokens: number | null; outputTokens: number | null; latencyMs: number; data: unknown },
  ): Promise<void> {
    const attributed = parsed.flags.filter(
      (flag) => flag.source.kind === 'posting' || (flag.source.label !== null && flag.source.url !== null),
    )

    if (attributed.length < parsed.flags.length) {
      this.logger.warn(
        `Dropped ${parsed.flags.length - attributed.length} unattributed flags on posting ${jobId}`,
      )
    }

    await this.db.transaction(async (tx) => {
      await tx.delete(jobFlags).where(eq(jobFlags.jobId, jobId))

      const values = {
        jobId,
        model: response.model,
        // Records which briefing this was, so `known: false` stays readable -
        // "nobody has written about them" and "we could not look" are
        // different answers.
        promptVersion: this.grounded
          ? JOB_INSIGHTS_PROMPT_VERSION
          : JOB_INSIGHTS_OFFLINE_PROMPT_VERSION,
        companyFacts: parsed.company,
        interviewBasis: parsed.interviewBasis,
        interviewStages: parsed.interviewStages,
        interviewQuestions: parsed.interviewQuestions,
        rawResponse: response.data as object,
        inputTokens: response.inputTokens,
        outputTokens: response.outputTokens,
        latencyMs: response.latencyMs,
      }

      await tx
        .insert(jobInsights)
        .values(values)
        .onConflictDoUpdate({ target: jobInsights.jobId, set: values })

      if (attributed.length > 0) {
        await tx.insert(jobFlags).values(
          attributed.map((flag, orderIndex) => ({
            jobId,
            orderIndex,
            polarity: flag.polarity,
            category: flag.category,
            text: flag.text,
            evidence: flag.evidence,
            sourceKind: flag.source.kind,
            sourceLabel: flag.source.label,
            sourceUrl: flag.source.url,
            sourceDate: flag.source.date,
          })),
        )
      }

      await tx.update(jobs).set({ insightsStatus: 'ready' }).where(eq(jobs.id, jobId))
    })
  }
}
