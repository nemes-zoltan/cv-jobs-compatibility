import { Injectable, Logger } from '@nestjs/common'
import { TerminalIngestionError } from '../../pipeline/terminal-ingestion-error'
import { JobExtractionService } from './job-extraction.service'
import { hasSomethingToGrade } from './job-normalisation'
import { JobPersistenceService } from './job-persistence.service'
import { JobStateService } from './job-state.service'

/**
 * The pipeline, in order, and nothing else.
 *
 * Shorter than the resume one by a step: the advert arrived as text, so there
 * is no file to fetch and nothing to extract before the model sees it.
 *
 * Each step is a service that knows one thing; this knows what order they go in
 * and what a failure means. Reading this method should be enough to know what
 * happens to a pasted posting.
 */
@Injectable()
export class JobIngestionService {
  private readonly logger = new Logger(JobIngestionService.name)

  constructor(
    private readonly state: JobStateService,
    private readonly extraction: JobExtractionService,
    private readonly persistence: JobPersistenceService,
  ) {}

  /**
   * Called when the queue is about to give up. The pipeline's own terminal
   * failures are handled below; this is for the ones that kept throwing.
   */
  abandon(jobId: string, detail: string): Promise<void> {
    return this.state.markAbandoned(jobId, detail)
  }

  async ingest(jobId: string): Promise<void> {
    const job = await this.state.claim(jobId)
    if (!job) return

    try {
      const { row, response } = await this.extraction.run(job)

      if (!response.valid || !response.job) {
        // The model's wording is on the extraction row and in the log. What the
        // user is told is ours to write.
        this.logger.log(`Posting ${jobId} rejected: ${response.rejectionReason}`)
        await this.state.markRejected(jobId)
        return
      }

      // Accepted, but with no requirements and no skills there is nothing to
      // grade a CV against. Left in the list it would look parsed and score
      // everybody identically, which is a worse answer than saying we could not
      // use it.
      if (!hasSomethingToGrade(response.job)) {
        this.logger.log(`Posting ${jobId} rejected: nothing gradeable was extracted`)
        await this.state.markRejected(jobId)
        return
      }

      await this.persistence.run(jobId, row.id, response.job)
      await this.state.markReady(jobId)
    } catch (error) {
      // Anything a later attempt could survive is left to reach pg-boss, which
      // retries it. Only failures that would repeat identically end here.
      if (!(error instanceof TerminalIngestionError)) throw error

      await this.state.markFailed(jobId, error.code, error.detail)
    }
  }
}
