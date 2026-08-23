import { Inject, Logger, Module, OnModuleInit } from '@nestjs/common'
import { PgBoss } from 'pg-boss'
import { GeminiModule } from '../../gemini/gemini.module'
import { PG_BOSS, QUEUES, type JobExtractionJob } from '../../queue/queue.constants'
import { TelemetryService } from '../../telemetry/telemetry.service'
import { JobExtractionService } from './job-extraction.service'
import { JobIngestionService } from './job-ingestion.service'
import { JobPersistenceService } from './job-persistence.service'
import { JobStateService } from './job-state.service'

/**
 * The worker's half of job postings. Imported by `WorkerModule` only - the API
 * enqueues and never runs, so nothing here is loaded in that process.
 */
@Module({
  imports: [GeminiModule],
  providers: [JobIngestionService, JobStateService, JobExtractionService, JobPersistenceService],
})
export class JobIngestionModule implements OnModuleInit {
  private readonly logger = new Logger(JobIngestionModule.name)

  constructor(
    @Inject(PG_BOSS) private readonly boss: PgBoss,
    private readonly ingestion: JobIngestionService,
    private readonly telemetry: TelemetryService,
  ) {}

  async onModuleInit(): Promise<void> {
    // No explicit type argument: pg-boss infers the handler's job type from the
    // options literal, and pinning the generic would collapse it back to a job
    // without the retry counters.
    await this.boss.work(
      QUEUES.jobExtraction,
      // One at a time, stated rather than inherited: the handler below unpacks a
      // single job, and a larger batch would silently drop the rest.
      // `includeMetadata` is what puts the retry counters on the job, which is
      // the only way the handler can tell it is on its last attempt.
      { batchSize: 1, includeMetadata: true },
      async ([job]) => {
        const { data } = job as { data: JobExtractionJob }

        try {
          // Throwing is how a job is failed and retried, so anything a later
          // attempt could survive is left to propagate. Failures that would
          // repeat identically are recorded on the posting and returned
          // normally.
          //
          // The span continues the trace this job was enqueued in, so pasting
          // an advert and everything the workers do about it minutes later read
          // as one trace rather than four.
          await this.telemetry.withLinkedSpan(
            'job-extraction',
            data,
            () => this.ingestion.ingest(data.jobId),
            { 'messaging.system': 'pg-boss', 'messaging.destination.name': 'job-extraction' },
          )
        } catch (error) {
          // pg-boss is about to stop retrying, and nothing else would ever move
          // this row off the status the failed attempt left it on.
          if (job.retryCount >= job.retryLimit) {
            await this.ingestion.abandon(
              data.jobId,
              error instanceof Error ? error.message : String(error),
            )
          }

          throw error
        }
      },
    )

    this.logger.log(`Working queue "${QUEUES.jobExtraction}"`)
  }
}
