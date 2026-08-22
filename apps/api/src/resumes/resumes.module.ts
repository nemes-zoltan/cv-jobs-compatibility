import { Module } from '@nestjs/common'
import { AuthModule } from '../auth/auth.module'
import { StorageModule } from '../storage/storage.module'
import { ResumeIngestionsController } from './resume-ingestions.controller'
import { ResumeIngestionsService } from './resume-ingestions.service'
import { ResumesController } from './resumes.controller'
import { ResumesService } from './resumes.service'

/**
 * Both halves of resumes: getting one in, and reading the one that is in.
 *
 * `AuthModule` is imported for `JwtAuthGuard`, which both controllers apply to
 * every route on them.
 */
@Module({
  imports: [AuthModule, StorageModule],
  controllers: [ResumeIngestionsController, ResumesController],
  providers: [ResumeIngestionsService, ResumesService],
})
export class ResumesModule {}
