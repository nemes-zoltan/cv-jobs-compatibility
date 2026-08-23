import { Injectable, Logger } from '@nestjs/common'
import { TerminalIngestionError } from '../../pipeline/terminal-ingestion-error'
import { IngestionStateService } from './ingestion-state.service'
import { ResumeExtractionService } from './resume-extraction.service'
import { ResumePersistenceService } from './resume-persistence.service'
import { ResumeTextService } from './resume-text.service'

/**
 * The pipeline, in order, and nothing else.
 *
 * Each step is a service that knows one thing; this knows what order they go in
 * and what a failure means. Reading this method should be enough to know what
 * happens to an uploaded CV.
 */
@Injectable()
export class IngestionService {
  private readonly logger = new Logger(IngestionService.name)

  constructor(
    private readonly state: IngestionStateService,
    private readonly text: ResumeTextService,
    private readonly extraction: ResumeExtractionService,
    private readonly persistence: ResumePersistenceService,
  ) {}

  /**
   * Called when the queue is about to give up. The pipeline's own terminal
   * failures are handled below; this is for the ones that kept throwing.
   */
  abandon(ingestionId: string, detail: string): Promise<void> {
    return this.state.markAbandoned(ingestionId, detail)
  }

  async ingest(ingestionId: string): Promise<void> {
    const ingestion = await this.state.claim(ingestionId)
    if (!ingestion) return

    try {
      const text = await this.text.run(ingestion)

      await this.state.markAnalyzing(ingestion.id)
      const { row, response } = await this.extraction.run(ingestion, text)

      if (!response.valid || !response.resume) {
        // The model's wording is on the extraction row and in the log. What the
        // user is told is ours to write.
        this.logger.log(`Ingestion ${ingestion.id} rejected: ${response.rejectionReason}`)
        await this.state.markRejected(ingestion.id)
        return
      }

      await this.persistence.run(ingestion, row.id, response.resume)
      await this.state.markReady(ingestion.id)
    } catch (error) {
      // Anything a later attempt could survive is left to reach pg-boss, which
      // retries it. Only failures that would repeat identically end here.
      if (!(error instanceof TerminalIngestionError)) throw error

      await this.state.markFailed(ingestion, error.code, error.detail)
    }
  }
}
