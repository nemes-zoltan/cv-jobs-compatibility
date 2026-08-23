import {
  MAX_JOB_SOURCE_URL_LENGTH,
  MAX_JOB_TEXT_CHARS,
  MIN_JOB_TEXT_CHARS,
} from '@cv-jobs-compatibility/constants'
import type { CreateJobRequest } from '@cv-jobs-compatibility/types'
import { Transform } from 'class-transformer'
import { IsOptional, IsString, IsUrl, MaxLength, MinLength } from 'class-validator'

/** Limits come from the same shared constants the paste box checks against. */
export class CreateJobDto implements CreateJobRequest {
  /**
   * Trimmed before the length rules run, so a box full of blank lines is short
   * rather than long enough to pay a model to read.
   */
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(MIN_JOB_TEXT_CHARS, {
    message: "That is too short to be a job posting - paste the whole advert, including what they're asking for",
  })
  @MaxLength(MAX_JOB_TEXT_CHARS, { message: 'That is longer than any job posting we can read' })
  text!: string

  /** Never fetched, so the only thing that matters is that it is a link. */
  @IsOptional()
  @IsUrl({ require_protocol: true }, { message: 'That does not look like a link' })
  @MaxLength(MAX_JOB_SOURCE_URL_LENGTH)
  sourceUrl?: string
}
