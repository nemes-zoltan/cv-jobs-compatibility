import { Module } from '@nestjs/common'
import { ConfigModule } from '../config/config.module'
import { DatabaseModule } from '../database/database.module'
import { QueueModule } from '../queue/queue.module'
import { IngestionModule } from '../resumes/ingestion/ingestion.module'

/**
 * The worker's root module. Same codebase as the API, different entrypoint:
 * no controllers, no HTTP server, and this is the process that supervises the
 * queue.
 */
@Module({
  imports: [
    ConfigModule,
    DatabaseModule,
    QueueModule.forRoot({ supervise: true }),
    IngestionModule,
  ],
})
export class WorkerModule {}
