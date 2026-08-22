import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common'
import type {
  LoginResponse,
  LogoutResponse,
  MeResponse,
  RefreshResponse,
  RegisterResponse,
} from '@cv-jobs-compatibility/types'
import type { Request, Response } from 'express'
import { BaseConfigService } from '../config/config.service'
import { toUserModel } from '../users/user.mapper'
import { UsersService } from '../users/users.service'
import {
  REFRESH_TOKEN_COOKIE,
  clearAuthCookies,
  setAccessCookie,
  setRefreshCookie,
  setSessionCookie,
} from './auth-cookies'
import { AuthService, IssuedTokens } from './auth.service'
import type { AuthenticatedUser } from './authenticated-request'
import { CurrentUser } from './current-user.decorator'
import { LoginDto } from './dto/login.dto'
import { RegisterDto } from './dto/register.dto'
import { JwtAuthGuard } from './jwt-auth.guard'

/**
 * Tokens are never returned in a response body: they are set as httpOnly
 * cookies and the body carries the user. That keeps them unreadable from
 * JavaScript and means a polling client sends them without doing anything.
 *
 * Signing in also sets a third cookie that carries no credential and marks only
 * that a session exists - see `SESSION_COOKIE`.
 *
 * `@Res({ passthrough: true })` gives access to the cookie API while leaving
 * Nest in charge of serialising the return value.
 */
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
    private readonly config: BaseConfigService,
  ) {}

  /** 201, or 409 when the address is taken. Signs the new account straight in. */
  @Post('register')
  async register(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<RegisterResponse> {
    const { user, tokens } = await this.authService.register(dto)
    this.startSession(res, tokens)

    return user
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response): Promise<LoginResponse> {
    const { user, tokens } = await this.authService.login(dto)
    this.startSession(res, tokens)

    return user
  }

  /**
   * Replaces the access cookie and nothing else, so the session still ends when
   * the refresh token reaches its original expiry. Answers 204: the result is
   * the `Set-Cookie` header, and a client that wants the user calls `/me`.
   */
  @Post('refresh')
  @HttpCode(HttpStatus.NO_CONTENT)
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<RefreshResponse> {
    const refreshToken = req.cookies?.[REFRESH_TOKEN_COOKIE] as string | undefined
    setAccessCookie(res, this.config, await this.authService.refresh(refreshToken))
  }

  /**
   * Unguarded on purpose: signing out with an already-expired access token has
   * to work, and there is nothing to authorise - the only effect is on cookies
   * the caller already holds.
   */
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  logout(@Res({ passthrough: true }) res: Response): LogoutResponse {
    clearAuthCookies(res, this.config)
  }

  /** Reads the account fresh, so the response reflects the database rather than
   * whatever was true when the token was signed. */
  @UseGuards(JwtAuthGuard)
  @Get('me')
  async me(@CurrentUser() current: AuthenticatedUser): Promise<MeResponse> {
    const user = await this.usersService.findById(current.id)
    // A valid token for an account that has since been deleted.
    if (!user) throw new UnauthorizedException('Account no longer exists')

    return toUserModel(user, await this.usersService.hasResume(user.id))
  }

  /** The three cookies a signed-in browser holds. Register and login differ in
   * how they arrive at the tokens and in nothing after that. */
  private startSession(res: Response, tokens: IssuedTokens): void {
    setAccessCookie(res, this.config, tokens.accessToken)
    setRefreshCookie(res, this.config, tokens.refreshToken)
    setSessionCookie(res, this.config)
  }
}
