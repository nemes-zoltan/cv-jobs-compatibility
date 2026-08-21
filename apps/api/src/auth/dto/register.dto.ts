import type { RegisterRequest } from '@cv-jobs-compatibility/types'
import { IsEmail, IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator'

/** Implements the shared contract, so a field renamed there fails to compile here. */
export class RegisterDto implements RegisterRequest {
  /** 254 is the practical maximum length of an email address (RFC 5321). */
  @IsEmail({}, { message: 'A valid email address is required' })
  @MaxLength(254)
  email!: string

  /**
   * Length is the only rule. Composition requirements ("one digit, one
   * symbol") push people towards predictable substitutions and are no longer
   * recommended by NIST; the upper bound just stops someone posting a megabyte
   * for argon2 to chew on.
   */
  @IsString()
  @MinLength(12, { message: 'Password must be at least 12 characters' })
  @MaxLength(128)
  password!: string

  @IsString()
  @IsNotEmpty({ message: 'Name is required' })
  @MaxLength(100)
  name!: string
}
