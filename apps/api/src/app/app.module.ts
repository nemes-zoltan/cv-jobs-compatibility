import { Module } from '@nestjs/common'
import { AuthModule } from '../auth/auth.module'
import { ConfigModule } from '../config/config.module'
import { DatabaseModule } from '../database/database.module'
import { HealthModule } from '../health/health.module'
import { QueueModule } from '../queue/queue.module'
import { ResumesModule } from '../resumes/resumes.module'
import { UsersModule } from '../users/users.module'
import { AppController } from './app.controller'
import { AppService } from './app.service'

@Module({
  imports: [
    ConfigModule,
    DatabaseModule,
    // The API enqueues; the worker is the one that supervises the queue.
    QueueModule.forRoot({ supervise: false }),
    HealthModule,
    UsersModule,
    AuthModule,
    ResumesModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
