import { Inject, Logger, Module, OnModuleInit } from '@nestjs/common'
import { PgBoss } from 'pg-boss'
import { GeminiModule } from '../../gemini/gemini.module'
import { PG_BOSS, QUEUES, type JobMatchJob } from '../../queue/queue.constants'
import { TelemetryService } from '../../telemetry/telemetry.service'
import { JobMatchService } from './job-match.service'

/**
 * The scoring worker. Imported by `WorkerModule` only.
 *
 * Its own queue like the other two, and for the sharpest reason yet: somebody
 * pressed a button and is watching a spinner, so this queue's retry budget is
 * set by a person's patience rather than by how badly the work is wanted.
 */
@Module({
  imports: [GeminiModule],
  providers: [JobMatchService],
})
export class JobMatchModule implements OnModuleInit {
  private readonly logger = new Logger(JobMatchModule.name)

  constructor(
    @Inject(PG_BOSS) private readonly boss: PgBoss,
    private readonly matches: JobMatchService,
    private readonly telemetry: TelemetryService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.boss.work(QUEUES.jobMatch, { batchSize: 1, includeMetadata: true }, async ([job]) => {
      const { data } = job as { data: JobMatchJob }

      try {
        // A queue handler has no incoming request, so nothing would create a
        // root span for it. This makes one, continuing the trace the job was
        // enqueued in - so pressing "score this role" and the grading that
        // follows are one trace rather than two.
        await this.telemetry.withLinkedSpan(
          'job-match',
          data,
          () => this.matches.run(data.matchId),
          { 'messaging.system': 'pg-boss', 'messaging.destination.name': 'job-match' },
        )
      } catch (error) {
        if (job.retryCount >= job.retryLimit) {
          await this.matches.abandon(
            data.matchId,
            error instanceof Error ? error.message : String(error),
          )
        }

        throw error
      }
    })

    this.logger.log(`Working queue "${QUEUES.jobMatch}"`)
  }
}
