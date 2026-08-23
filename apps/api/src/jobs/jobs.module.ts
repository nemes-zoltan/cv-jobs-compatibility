import { Module } from '@nestjs/common'
import { AuthModule } from '../auth/auth.module'
import { JobsController } from './jobs.controller'
import { JobsService } from './jobs.service'
import { MatchesService } from './matches.service'

/**
 * Job postings and who is tracking them.
 *
 * `AuthModule` is imported for `JwtAuthGuard`, which the controller applies to
 * every route on it. Reading a posting is all this does; parsing one belongs to
 * the worker.
 */
@Module({
  imports: [AuthModule],
  controllers: [JobsController],
  providers: [JobsService, MatchesService],
})
export class JobsModule {}
