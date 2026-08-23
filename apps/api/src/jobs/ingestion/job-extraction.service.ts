import {
  JOB_EXTRACTION_PROMPT_VERSION,
  JOB_EXTRACTION_RESPONSE_SCHEMA,
  JOB_EXTRACTION_SYSTEM_PROMPT,
  type JobExtractionResponse,
  buildJobExtractionPrompt,
  jobExtractionResponseSchema,
} from '@cv-jobs-compatibility/prompt-schemas'
import { Inject, Injectable, Logger } from '@nestjs/common'
import { desc, eq } from 'drizzle-orm'
import { DRIZZLE } from '../../database/database.constants'
import type { Database } from '../../database/database.module'
import { type JobExtractionRow, type JobRow, jobExtractions, jobTexts } from '../../database/schema'
import { GeminiService, MalformedModelResponseError } from '../../gemini/gemini.service'
import { TerminalIngestionError } from '../../pipeline/terminal-ingestion-error'

export interface CompletedJobExtraction {
  row: JobExtractionRow
  response: JobExtractionResponse
}

/**
 * The pasted advert becomes a structured reading of it.
 *
 * Loads the text itself rather than being handed it, because the reuse check
 * below can answer without it - a retry that already paid for a model call
 * should not also pay for the twenty kilobytes it would have read.
 *
 * The attempt is recorded before it is judged. A failure while writing the
 * requirement rows is then something a retry can recover from without paying
 * for the model twice, which is the whole reason this table exists.
 */
@Injectable()
export class JobExtractionService {
  private readonly logger = new Logger(JobExtractionService.name)

  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly gemini: GeminiService,
  ) {}

  async run(job: JobRow): Promise<CompletedJobExtraction> {
    const reusable = await this.findReusable(job.id)
    if (reusable) {
      this.logger.log(`Reusing extraction ${reusable.row.id} for posting ${job.id}`)
      return reusable
    }

    const text = await this.loadText(job.id)
    const response = await this.ask(job.id, text)
    const parsed = this.parse(response.data)

    const [row] = await this.db
      .insert(jobExtractions)
      .values({
        jobId: job.id,
        model: response.model,
        promptVersion: JOB_EXTRACTION_PROMPT_VERSION,
        isValid: parsed.valid,
        rejectionReason: parsed.rejectionReason,
        // Exactly what came back, before any interpretation.
        rawResponse: response.data as object,
        inputTokens: response.inputTokens,
        outputTokens: response.outputTokens,
        latencyMs: response.latencyMs,
      })
      .returning()

    this.logger.log(
      parsed.valid && parsed.job
        ? `Extraction ${row.id}: valid, ${parsed.job.requirements.length} requirements, ` +
            `${parsed.job.skills.length} skills, ${parsed.job.responsibilities.length} responsibilities`
        : `Extraction ${row.id}: not a job posting (${parsed.rejectionReason})`,
    )

    return { row, response: parsed }
  }

  /**
   * No truncation here, unlike the resume pipeline: the text arrived through a
   * DTO that caps it well below anything worth trimming, so a posting long
   * enough to be expensive never reaches the database in the first place.
   */
  private async loadText(jobId: string): Promise<string> {
    const [row] = await this.db
      .select({ content: jobTexts.content })
      .from(jobTexts)
      .where(eq(jobTexts.jobId, jobId))
      .limit(1)

    // The row and its text are written in one transaction, so this means the
    // text was deleted underneath us. Another attempt finds the same nothing.
    if (!row) throw new TerminalIngestionError('The posting has no stored text', 'missing_text')

    this.logger.log(`Read ${row.content.length} characters of posting ${jobId}`)

    return row.content
  }

  private async ask(jobId: string, text: string) {
    this.logger.log(`Asking the model about posting ${jobId} (${text.length} characters)`)

    try {
      const response = await this.gemini.generateJson({
        systemPrompt: JOB_EXTRACTION_SYSTEM_PROMPT,
        prompt: buildJobExtractionPrompt(text),
        responseSchema: JOB_EXTRACTION_RESPONSE_SCHEMA,
      })

      this.logger.log(
        `Model answered for posting ${jobId} in ${response.latencyMs}ms ` +
          `(${response.inputTokens ?? '?'} in, ${response.outputTokens ?? '?'} out)`,
      )
      // The whole answer, at debug, because the useful thing while a prompt is
      // being tuned is what actually came back rather than a count of it. It is
      // on the extraction row too, but nobody reaches for psql mid-run.
      this.logger.debug(JSON.stringify(response.data, null, 2))

      return response
    } catch (error) {
      // Unparseable output is not worth three more attempts at the same text;
      // anything else - a rate limit, a timeout, a 503 - is exactly what retries
      // are for, so it propagates.
      if (error instanceof MalformedModelResponseError) {
        throw new TerminalIngestionError('The model did not return usable JSON', 'malformed_response')
      }

      throw error
    }
  }

  /**
   * The response schema constrains the shape but not the sense of it: nothing
   * stops a model answering `valid: true` with no posting attached. Both halves
   * are checked here so everything downstream can trust the pairing.
   */
  private parse(data: unknown): JobExtractionResponse {
    const result = jobExtractionResponseSchema.safeParse(data)

    if (!result.success) {
      throw new TerminalIngestionError(
        `Response did not match the schema: ${result.error.message}`,
        'malformed_response',
      )
    }

    if (result.data.valid && !result.data.job) {
      throw new TerminalIngestionError(
        'Model reported a valid posting but returned none',
        'malformed_response',
      )
    }

    return result.data
  }

  /**
   * A retry that already paid for a model call reuses its answer.
   *
   * Only the latest attempt is considered, and only when it produced something
   * worth persisting - a rejection is already terminal, so it never gets here.
   */
  private async findReusable(jobId: string): Promise<CompletedJobExtraction | null> {
    const [row] = await this.db
      .select()
      .from(jobExtractions)
      .where(eq(jobExtractions.jobId, jobId))
      .orderBy(desc(jobExtractions.createdAt))
      .limit(1)

    if (!row?.isValid) return null

    const result = jobExtractionResponseSchema.safeParse(row.rawResponse)
    if (!result.success || !result.data.job) return null

    return { row, response: result.data }
  }
}
