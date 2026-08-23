import type {
  CreateJobMatchResponse,
  CreateJobResponse,
  DeleteJobResponse,
  JobListResponse,
  JobMatchResponse,
  JobResponse,
  PendingJobResponse,
  RetryJobInsightsResponse,
} from '@cv-jobs-compatibility/types'
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common'
import type { AuthenticatedUser } from '../auth/authenticated-request'
import { CurrentUser } from '../auth/current-user.decorator'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { CreateJobDto } from './dto/create-job.dto'
import { ListJobsDto } from './dto/list-jobs.dto'
import { JobsService } from './jobs.service'
import { MatchesService } from './matches.service'

/**
 * Job postings on the caller's list.
 *
 * Every route is scoped to the caller even though a posting itself is not:
 * `saved_jobs` is what makes one reachable, so an id nobody has saved is an id
 * that does not exist as far as these routes are concerned.
 */
@UseGuards(JwtAuthGuard)
@Controller('jobs')
export class JobsController {
  constructor(
    private readonly jobs: JobsService,
    private readonly matches: MatchesService,
  ) {}

  @Get()
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListJobsDto,
  ): Promise<JobListResponse> {
    return this.jobs.findAll(user.id, query)
  }

  /**
   * Declared before `:id` - Nest matches routes in declaration order, and the
   * other way round this path is read as a posting whose id is "pending".
   */
  @Get('pending')
  findPending(@CurrentUser() user: AuthenticatedUser): Promise<PendingJobResponse> {
    return this.jobs.findPending(user.id)
  }

  @Get(':id')
  findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<JobResponse> {
    return this.jobs.findOne(user.id, id)
  }

  /** Registers a pasted advert. `409` while one is still being read. */
  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateJobDto): Promise<CreateJobResponse> {
    return this.jobs.create(user.id, dto)
  }

  /**
   * Asks for the briefing again after one failed - a rate limit or an exhausted
   * quota, which no amount of backoff recovers from.
   */
  @Post(':id/insights')
  retryInsights(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<RetryJobInsightsResponse> {
    return this.jobs.retryInsights(user.id, id)
  }

  /**
   * Scores this posting against the caller's CV.
   *
   * A thing a person asks for rather than something that happens on its own:
   * one model call per posting, and after a new CV every posting would want one
   * at the same moment.
   */
  @Post(':id/match')
  createMatch(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<CreateJobMatchResponse> {
    return this.matches.create(user.id, id)
  }

  @Get(':id/match')
  findMatch(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<JobMatchResponse> {
    return this.matches.findOne(user.id, id)
  }

  /** Takes it off the caller's list. The posting itself is left alone. */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<DeleteJobResponse> {
    return this.jobs.remove(user.id, id)
  }
}
