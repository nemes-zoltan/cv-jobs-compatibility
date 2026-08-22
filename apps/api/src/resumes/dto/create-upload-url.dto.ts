import type { CreateUploadUrlRequest } from '@cv-jobs-compatibility/types'
import {
  MAX_RESUME_BYTES,
  MAX_RESUME_FILENAME_LENGTH,
  RESUME_CONTENT_TYPES,
} from '@cv-jobs-compatibility/constants'
import { IsIn, IsInt, IsNotEmpty, IsString, Max, MaxLength, Min } from 'class-validator'

/** Limits come from the same shared constants the browser checks against. */
export class CreateUploadUrlDto implements CreateUploadUrlRequest {
  @IsString()
  @IsNotEmpty({ message: 'A filename is required' })
  @MaxLength(MAX_RESUME_FILENAME_LENGTH)
  filename!: string

  @IsIn(RESUME_CONTENT_TYPES, { message: 'Only PDF and DOCX files are accepted' })
  contentType!: string

  /** A claim, believed only far enough to refuse an oversized file up front. */
  @IsInt()
  @Min(1, { message: 'The file is empty' })
  @Max(MAX_RESUME_BYTES, { message: 'The file is larger than 10 MB' })
  sizeBytes!: number
}
