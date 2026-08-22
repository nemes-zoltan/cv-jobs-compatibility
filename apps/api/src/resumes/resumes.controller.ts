import type { MyResumeResponse } from '@cv-jobs-compatibility/types'
import { Controller, Get, UseGuards } from '@nestjs/common'
import type { AuthenticatedUser } from '../auth/authenticated-request'
import { CurrentUser } from '../auth/current-user.decorator'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { ResumesService } from './resumes.service'

/** Parsed CVs. Uploading one is `ResumeIngestionsController`'s business. */
@UseGuards(JwtAuthGuard)
@Controller('resumes')
export class ResumesController {
  constructor(private readonly resumes: ResumesService) {}

  /**
   * The caller's CV. `404` until one has been through the pipeline, which is
   * also what `hasResume` on the session reports.
   */
  @Get('me')
  findMine(@CurrentUser() user: AuthenticatedUser): Promise<MyResumeResponse> {
    return this.resumes.findForUser(user.id)
  }
}
