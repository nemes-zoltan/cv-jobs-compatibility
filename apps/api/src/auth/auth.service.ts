import type { LoginRequest, RegisterRequest, UserModel } from '@cv-jobs-compatibility/types'
import { Injectable, UnauthorizedException } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import * as argon2 from 'argon2'
import { randomBytes } from 'node:crypto'
import { BaseConfigService } from '../config/config.service'
import { toUserModel } from '../users/user.mapper'
import { UsersService } from '../users/users.service'

export type TokenType = 'access' | 'refresh'

/**
 * Both tokens carry an id and nothing else. Copying the email or the name in
 * would mean serving stale values for as long as the token lives, and a claim
 * nobody reads is a claim nobody maintains.
 */
export interface TokenPayload {
  sub: string
  type: TokenType
}

export interface IssuedTokens {
  accessToken: string
  refreshToken: string
}

export interface AuthResult {
  user: UserModel
  tokens: IssuedTokens
}

/**
 * One message for every way a sign-in can fail. Distinguishing "no such
 * account" from "wrong password" would turn the login form into an oracle for
 * which addresses are registered.
 */
const INVALID_CREDENTIALS = 'Invalid email or password'

/** What a caller sees when a token is missing, expired, tampered with, or of
 * the wrong kind - the client's move is the same in all four cases. */
const INVALID_SESSION = 'Session expired or invalid'

@Injectable()
export class AuthService {
  /** Built once, on the first sign-in attempt for an unknown address. */
  private decoyHash?: string

  constructor(
    private readonly users: UsersService,
    private readonly jwt: JwtService,
    private readonly config: BaseConfigService,
  ) {}

  async register(dto: RegisterRequest): Promise<AuthResult> {
    // The library's defaults (64 MiB, 3 passes) are already above the OWASP
    // argon2id minimum; they are worth revisiting against the CPU and memory a
    // deployed task actually gets.
    const passwordHash = await argon2.hash(dto.password, { type: argon2.argon2id })
    const user = await this.users.create({ email: dto.email, name: dto.name, passwordHash })

    return { user: toUserModel(user), tokens: await this.issueTokens(user.id) }
  }

  async login(dto: LoginRequest): Promise<AuthResult> {
    const user = await this.users.findByEmail(dto.email)

    if (!user) {
      // Returning immediately here would make an unknown address answer
      // measurably faster than a known one with a bad password, which leaks
      // exactly what the shared error message is hiding.
      await this.verifyAgainstDecoy(dto.password)
      throw new UnauthorizedException(INVALID_CREDENTIALS)
    }

    if (!(await argon2.verify(user.passwordHash, dto.password))) {
      throw new UnauthorizedException(INVALID_CREDENTIALS)
    }

    return { user: toUserModel(user), tokens: await this.issueTokens(user.id) }
  }

  /**
   * Trades a valid refresh token for a fresh access token.
   *
   * The refresh token itself is left alone: it is not rotated, so several
   * requests that expire at the same moment can all refresh concurrently
   * without racing each other. The cost of that simplicity is that the session
   * cannot be revoked server-side - see DECISIONS.md.
   */
  async refresh(refreshToken: string | undefined): Promise<string> {
    const { sub } = await this.verifyToken(refreshToken, 'refresh')

    return this.signToken(sub, 'access', this.config.accessTokenTtl)
  }

  async verifyToken(token: string | undefined, expected: TokenType): Promise<TokenPayload> {
    if (!token) throw new UnauthorizedException(INVALID_SESSION)

    let payload: TokenPayload
    try {
      payload = await this.jwt.verifyAsync<TokenPayload>(token)
    } catch {
      throw new UnauthorizedException(INVALID_SESSION)
    }

    // Both kinds are signed with the same key, so this claim is the only thing
    // stopping a week-long refresh token from being used as an access token.
    if (payload.type !== expected) throw new UnauthorizedException(INVALID_SESSION)

    return payload
  }

  private async issueTokens(userId: string): Promise<IssuedTokens> {
    const [accessToken, refreshToken] = await Promise.all([
      this.signToken(userId, 'access', this.config.accessTokenTtl),
      this.signToken(userId, 'refresh', this.config.refreshTokenTtl),
    ])

    return { accessToken, refreshToken }
  }

  private signToken(userId: string, type: TokenType, ttlSeconds: number): Promise<string> {
    const payload: TokenPayload = { sub: userId, type }

    return this.jwt.signAsync(payload, { expiresIn: ttlSeconds })
  }

  /** Spends roughly the same time a real verification would, against a hash of
   * a random string that no submitted password can match. */
  private async verifyAgainstDecoy(password: string): Promise<void> {
    const decoy = (this.decoyHash ??= await argon2.hash(randomBytes(32).toString('hex'), {
      type: argon2.argon2id,
    }))

    await argon2.verify(decoy, password)
  }
}
