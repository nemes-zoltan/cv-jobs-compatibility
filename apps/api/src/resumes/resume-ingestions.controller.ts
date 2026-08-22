import type {
  CreateResumeIngestionResponse,
  DeleteResumeIngestionResponse,
  CreateUploadUrlResponse,
  PendingResumeIngestionResponse,
  ResumeIngestionResponse,
} from '@cv-jobs-compatibility/types'
import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common'
import type { AuthenticatedUser } from '../auth/authenticated-request'
import { CurrentUser } from '../auth/current-user.decorator'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { StorageService } from '../storage/storage.service'
import { CreateResumeIngestionDto } from './dto/create-resume-ingestion.dto'
import { CreateUploadUrlDto } from './dto/create-upload-url.dto'
import { buildResumeKey, isKeyOwnedBy } from './resume-keys'
import { ResumeIngestionsService } from './resume-ingestions.service'

/**
 * Getting a CV into the system: signing an upload, recording it, watching it
 * through the pipeline, and throwing it away.
 *
 * Separate from `ResumesController`, which serves the finished article. These
 * routes are about a file and its processing; that one is about a parsed CV,
 * and the two stop having anything to do with each other the moment a resume
 * row exists.
 *
 * File bytes never reach this process, and nothing is recorded until the upload
 * has finished - see DECISIONS.md for that ordering.
 */
@UseGuards(JwtAuthGuard)
@Controller('resumes/ingestions')
export class ResumeIngestionsController {
  constructor(
    private readonly storage: StorageService,
    private readonly resumes: ResumeIngestionsService,
  ) {}

  /**
   * Signs a URL for one file and records nothing. The key is minted here rather
   * than accepted, so a client cannot aim at a prefix it does not own.
   */
  @Post('upload-url')
  async createUploadUrl(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateUploadUrlDto,
  ): Promise<CreateUploadUrlResponse> {
    const key = buildResumeKey(user.id, dto.filename)
    const { url, expiresAt } = await this.storage.createUploadUrl({
      key,
      contentType: dto.contentType,
    })

    return { key, uploadUrl: url, expiresAt: expiresAt.toISOString() }
  }

  /** Reports a finished upload, which is what puts it in the queue. */
  @Post()
  createUpload(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateResumeIngestionDto,
  ): Promise<CreateResumeIngestionResponse> {
    if (!isKeyOwnedBy(dto.key, user.id)) {
      throw new ForbiddenException('That upload does not belong to you')
    }

    return this.resumes.createUpload(user.id, dto)
  }

  /**
   * Declared before `:id` - Nest matches routes in declaration order, and the
   * other way round this path is read as an upload whose id is "pending".
   */
  @Get('pending')
  findPendingUpload(@CurrentUser() user: AuthenticatedUser): Promise<PendingResumeIngestionResponse> {
    return this.resumes.findPendingUpload(user.id)
  }

  @Get(':id')
  findUpload(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ResumeIngestionResponse> {
    return this.resumes.findUpload(user.id, id)
  }

  /** Throws away an upload: a rejected CV, one that stalled, or one being
   * replaced. */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteUpload(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<DeleteResumeIngestionResponse> {
    return this.resumes.deleteUpload(user.id, id)
  }
}
