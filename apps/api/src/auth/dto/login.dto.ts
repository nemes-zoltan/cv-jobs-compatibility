import type { LoginRequest } from '@cv-jobs-compatibility/types'
import { IsEmail, IsNotEmpty, IsString, MaxLength } from 'class-validator'

/**
 * Intentionally looser than `RegisterDto`: a sign-in form should reject a wrong
 * password, not explain the password policy to whoever is guessing. The only
 * limits here are the ones that keep absurd input away from argon2.
 */
export class LoginDto implements LoginRequest {
  @IsEmail({}, { message: 'A valid email address is required' })
  @MaxLength(254)
  email!: string

  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  password!: string
}
