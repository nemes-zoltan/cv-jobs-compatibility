import {
  MAX_RESUME_BYTES,
  MAX_RESUME_FILENAME_LENGTH,
  RESUME_CONTENT_TYPES,
} from '@cv-jobs-compatibility/constants'
import type { CreateResumeIngestionRequest } from '@cv-jobs-compatibility/types'
import { IsIn, IsInt, IsNotEmpty, IsString, Max, MaxLength, Min } from 'class-validator'

/**
 * These rules only establish that the body is well-formed. Whether the key
 * belongs to the caller is decided in the controller, and whether the numbers
 * describe the file that actually landed is decided against `HeadObject`.
 */
export class CreateResumeIngestionDto implements CreateResumeIngestionRequest {
  @IsString()
  @IsNotEmpty({ message: 'An upload key is required' })
  // Comfortably above `resumes/<uuid>/<uuid>/<100 chars>`.
  @MaxLength(512)
  key!: string

  @IsString()
  @IsNotEmpty({ message: 'A filename is required' })
  @MaxLength(MAX_RESUME_FILENAME_LENGTH)
  filename!: string

  @IsIn(RESUME_CONTENT_TYPES, { message: 'Only PDF and DOCX files are accepted' })
  contentType!: string

  @IsInt()
  @Min(1, { message: 'The file is empty' })
  @Max(MAX_RESUME_BYTES, { message: 'The file is larger than 10 MB' })
  sizeBytes!: number
}
