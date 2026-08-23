import { JOBS_PAGE_SIZE, MAX_JOBS_PAGE_SIZE } from '@cv-jobs-compatibility/constants'
import { Type } from 'class-transformer'
import { IsInt, IsOptional, Max, Min } from 'class-validator'

/**
 * Query parameters arrive as strings, so `@Type` is what turns `?page=2` into
 * a number the rules below can judge. The ceiling on `pageSize` is the point of
 * validating this at all: without it a client asks for every posting at once.
 */
export class ListJobsDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_JOBS_PAGE_SIZE)
  pageSize: number = JOBS_PAGE_SIZE
}
