import { Inject, Logger, Module, OnModuleInit } from '@nestjs/common'
import { PgBoss } from 'pg-boss'
import { GeminiModule } from '../../gemini/gemini.module'
import { PG_BOSS, QUEUES, type ResumeIngestionJob } from '../../queue/queue.constants'
import { StorageModule } from '../../storage/storage.module'
import { IngestionStateService } from './ingestion-state.service'
import { IngestionService } from './ingestion.service'
import { ResumeExtractionService } from './resume-extraction.service'
import { ResumePersistenceService } from './resume-persistence.service'
import { ResumeTextService } from './resume-text.service'
import { TextExtractionService } from './text-extraction.service'

/**
 * The worker's half of resumes. Imported by `WorkerModule` only - the API
 * enqueues jobs and never runs them, so nothing here is loaded in that process.
 */
@Module({
  imports: [StorageModule, GeminiModule],
  providers: [
    IngestionService,
    IngestionStateService,
    ResumeTextService,
    TextExtractionService,
    ResumeExtractionService,
    ResumePersistenceService,
  ],
})
export class IngestionModule implements OnModuleInit {
  private readonly logger = new Logger(IngestionModule.name)

  constructor(
    @Inject(PG_BOSS) private readonly boss: PgBoss,
    private readonly ingestion: IngestionService,
  ) {}

  async onModuleInit(): Promise<void> {
    // No explicit type argument: pg-boss infers the handler's job type from the
    // options literal, and pinning the generic would collapse it back to a job
    // without the retry counters.
    await this.boss.work(
      QUEUES.resumeIngestion,
      // One at a time, stated rather than inherited: the handler below unpacks a
      // single job, and a larger batch would silently drop the rest.
      // `includeMetadata` is what puts the retry counters on the job, which is
      // the only way the handler can tell it is on its last attempt.
      { batchSize: 1, includeMetadata: true },
      async ([job]) => {
        const { data } = job as { data: ResumeIngestionJob }

        try {
          // Throwing is how a job is failed and retried, so anything that a
          // later attempt could survive is left to propagate. Failures that
          // would repeat identically are recorded on the ingestion and returned
          // normally.
          await this.ingestion.ingest(data.ingestionId)
        } catch (error) {
          // pg-boss is about to stop retrying, and nothing else would ever move
          // this row off the status the failed attempt left it on.
          if (job.retryCount >= job.retryLimit) {
            await this.ingestion.abandon(
              data.ingestionId,
              error instanceof Error ? error.message : String(error),
            )
          }

          throw error
        }
      },
    )

    this.logger.log(`Working queue "${QUEUES.resumeIngestion}"`)
  }
}
