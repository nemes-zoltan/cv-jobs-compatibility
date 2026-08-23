import {
  RESUME_EXTRACTION_PROMPT_VERSION,
  RESUME_EXTRACTION_RESPONSE_SCHEMA,
  RESUME_EXTRACTION_SYSTEM_PROMPT,
  type ResumeExtractionResponse,
  buildResumeExtractionPrompt,
  resumeExtractionResponseSchema,
} from '@cv-jobs-compatibility/prompt-schemas'
import { Inject, Injectable, Logger } from '@nestjs/common'
import { desc, eq } from 'drizzle-orm'
import { DRIZZLE } from '../../database/database.constants'
import type { Database } from '../../database/database.module'
import { type ResumeExtractionRow, type ResumeIngestionRow, resumeExtractions } from '../../database/schema'
import { MalformedModelResponseError, GeminiService } from '../../gemini/gemini.service'
import { TerminalIngestionError } from '../../pipeline/terminal-ingestion-error'

/**
 * How much of a document is sent to the model.
 *
 * Far beyond any real CV. It exists because the upload cap is ten megabytes and
 * a PDF that size full of text would otherwise be billed in full, so a junk file
 * cannot turn into a large invoice.
 */
const MAX_PROMPT_CHARACTERS = 50_000

export interface CompletedExtraction {
  row: ResumeExtractionRow
  response: ResumeExtractionResponse
}

/**
 * Step two: the text becomes a structured reading of it.
 *
 * The attempt is recorded before it is judged. A failure while writing the
 * resume rows is then something a retry can recover from without paying for the
 * model twice, which is the whole reason this table exists.
 */
@Injectable()
export class ResumeExtractionService {
  private readonly logger = new Logger(ResumeExtractionService.name)

  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly gemini: GeminiService,
  ) {}

  async run(ingestion: ResumeIngestionRow, text: string): Promise<CompletedExtraction> {
    const reusable = await this.findReusable(ingestion.id)
    if (reusable) {
      this.logger.log(`Reusing extraction ${reusable.row.id} for ingestion ${ingestion.id}`)
      return reusable
    }

    const response = await this.ask(ingestion.id, text)
    const parsed = this.parse(response.data)

    const [row] = await this.db
      .insert(resumeExtractions)
      .values({
        ingestionId: ingestion.id,
        model: response.model,
        promptVersion: RESUME_EXTRACTION_PROMPT_VERSION,
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
      parsed.valid && parsed.resume
        ? `Extraction ${row.id}: valid, ${parsed.resume.experiences.length} roles, ` +
            `${parsed.resume.education.length} education, ${parsed.resume.skills.length} skills, ` +
            `${parsed.resume.projects.length} projects`
        : `Extraction ${row.id}: not a CV (${parsed.rejectionReason})`,
    )

    return { row, response: parsed }
  }

  private async ask(ingestionId: string, text: string) {
    const truncated = text.slice(0, MAX_PROMPT_CHARACTERS)
    if (truncated.length < text.length) {
      this.logger.warn(`Truncated document from ${text.length} to ${MAX_PROMPT_CHARACTERS} characters`)
    }

    this.logger.log(`Asking the model about CV ${ingestionId} (${truncated.length} characters)`)

    try {
      const response = await this.gemini.generateJson({
        systemPrompt: RESUME_EXTRACTION_SYSTEM_PROMPT,
        prompt: buildResumeExtractionPrompt(truncated),
        responseSchema: RESUME_EXTRACTION_RESPONSE_SCHEMA,
      })

      this.logger.log(
        `Model answered for CV ${ingestionId} in ${response.latencyMs}ms ` +
          `(${response.inputTokens ?? '?'} in, ${response.outputTokens ?? '?'} out)`,
      )
      // The whole answer, at debug, because the useful thing while a prompt is
      // being tuned is what actually came back rather than a count of it. It is
      // on the extraction row too, but nobody reaches for psql mid-run.
      this.logger.debug(JSON.stringify(response.data, null, 2))

      return response
    } catch (error) {
      // Unparseable output is not worth three more attempts at the same
      // document; anything else - a rate limit, a timeout, a 503 - is exactly
      // what retries are for, so it propagates.
      if (error instanceof MalformedModelResponseError) {
        throw new TerminalIngestionError('The model did not return usable JSON')
      }

      throw error
    }
  }

  /**
   * The response schema constrains the shape but not the sense of it: nothing
   * stops a model answering `valid: true` with no resume attached. Both halves
   * are checked here so everything downstream can trust the pairing.
   */
  private parse(data: unknown): ResumeExtractionResponse {
    const result = resumeExtractionResponseSchema.safeParse(data)

    if (!result.success) {
      throw new TerminalIngestionError(`Response did not match the schema: ${result.error.message}`)
    }

    if (result.data.valid && !result.data.resume) {
      throw new TerminalIngestionError('Model reported a valid CV but returned no resume')
    }

    return result.data
  }

  /**
   * A retry that already paid for a model call reuses its answer.
   *
   * Only the latest attempt is considered, and only when it produced something
   * worth persisting - a rejection is already terminal, so it never gets here.
   */
  private async findReusable(ingestionId: string): Promise<CompletedExtraction | null> {
    const [row] = await this.db
      .select()
      .from(resumeExtractions)
      .where(eq(resumeExtractions.ingestionId, ingestionId))
      .orderBy(desc(resumeExtractions.createdAt))
      .limit(1)

    if (!row?.isValid) return null

    const result = resumeExtractionResponseSchema.safeParse(row.rawResponse)
    if (!result.success || !result.data.resume) return null

    return { row, response: result.data }
  }
}
