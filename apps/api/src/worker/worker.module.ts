import { Module } from '@nestjs/common'
import { ConfigModule } from '../config/config.module'
import { DatabaseModule } from '../database/database.module'
import { JobIngestionModule } from '../jobs/ingestion/job-ingestion.module'
import { JobInsightsModule } from '../jobs/insights/job-insights.module'
import { JobMatchModule } from '../jobs/matching/job-match.module'
import { QueueModule } from '../queue/queue.module'
import { IngestionModule } from '../resumes/ingestion/ingestion.module'
import { TelemetryModule } from '../telemetry/telemetry.module'

/**
 * The worker's root module. Same codebase as the API, different entrypoint:
 * no controllers, no HTTP server, and this is the process that supervises the
 * queue.
 */
@Module({
  imports: [
    ConfigModule,
    TelemetryModule,
    DatabaseModule,
    QueueModule.forRoot({ supervise: true }),
    IngestionModule,
    JobIngestionModule,
    JobInsightsModule,
    JobMatchModule,
  ],
})
export class WorkerModule {}
