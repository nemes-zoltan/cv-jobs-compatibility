import { Inject, Logger, Module, OnModuleInit } from '@nestjs/common'
import { PgBoss } from 'pg-boss'
import { GeminiModule } from '../../gemini/gemini.module'
import { PG_BOSS, QUEUES, type JobInsightsJob } from '../../queue/queue.constants'
import { TelemetryService } from '../../telemetry/telemetry.service'
import { JobInsightsService } from './job-insights.service'

/**
 * The briefing worker. Imported by `WorkerModule` only.
 *
 * Its own queue rather than a step in the extraction handler, so a briefing
 * that fails retries on its own schedule and never touches the posting's
 * status.
 */
@Module({
  imports: [GeminiModule],
  providers: [JobInsightsService],
})
export class JobInsightsModule implements OnModuleInit {
  private readonly logger = new Logger(JobInsightsModule.name)

  constructor(
    @Inject(PG_BOSS) private readonly boss: PgBoss,
    private readonly insights: JobInsightsService,
    private readonly telemetry: TelemetryService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.boss.work(
      QUEUES.jobInsights,
      { batchSize: 1, includeMetadata: true },
      async ([job]) => {
        const { data } = job as { data: JobInsightsJob }

        try {
          // A queue handler has no incoming request, so nothing would create a
          // root span for it. This makes one, continuing the trace the job was
          // enqueued in - so pasting an advert and everything the workers do
          // about it minutes later is one trace rather than four.
          await this.telemetry.withLinkedSpan(
            'job-insights',
            data,
            () => this.insights.brief(data.jobId),
            { 'messaging.system': 'pg-boss', 'messaging.destination.name': 'job-insights' },
          )
        } catch (error) {
          if (job.retryCount >= job.retryLimit) {
            await this.insights.abandon(
              data.jobId,
              error instanceof Error ? error.message : String(error),
            )
          }

          throw error
        }
      },
    )

    this.logger.log(`Working queue "${QUEUES.jobInsights}"`)
  }
}
