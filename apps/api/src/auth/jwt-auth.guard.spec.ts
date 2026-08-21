import { ExecutionContext, UnauthorizedException } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { BaseConfigService } from '../config/config.service'
import { UsersService } from '../users/users.service'
import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE } from './auth-cookies'
import { AuthService, TokenPayload } from './auth.service'
import { AuthenticatedRequest } from './authenticated-request'
import { JwtAuthGuard } from './jwt-auth.guard'

const JWT_SECRET = 'test-secret'
const jwt = new JwtService({ secret: JWT_SECRET })

const config = { accessTokenTtl: 60, refreshTokenTtl: 604800, jwtSecret: JWT_SECRET } as BaseConfigService

/** The guard only reads cookies off the request, so nothing else is needed. */
function contextWithCookies(cookies: Record<string, string>) {
  const request = { cookies } as unknown as AuthenticatedRequest

  return {
    context: { switchToHttp: () => ({ getRequest: () => request }) } as ExecutionContext,
    request,
  }
}

describe('JwtAuthGuard', () => {
  // The guard needs nothing from UsersService, only token verification.
  const guard = new JwtAuthGuard(new AuthService({} as UsersService, jwt, config))

  it('attaches the caller to the request for a valid access cookie', async () => {
    const token = await jwt.signAsync({ sub: 'user-1', type: 'access' } satisfies TokenPayload, { expiresIn: 60 })
    const { context, request } = contextWithCookies({ [ACCESS_TOKEN_COOKIE]: token })

    await expect(guard.canActivate(context)).resolves.toBe(true)
    expect(request.user).toEqual({ id: 'user-1' })
  })

  it('rejects a request with no access cookie', async () => {
    const { context } = contextWithCookies({})

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException)
  })

  /**
   * The refresh cookie is scoped to `/api/auth`, so it should never reach a
   * guarded route - but the guard must not accept it even if it does.
   */
  it('rejects a refresh token supplied under the access cookie name', async () => {
    const token = await jwt.signAsync({ sub: 'user-1', type: 'refresh' } satisfies TokenPayload, { expiresIn: 604800 })
    const { context } = contextWithCookies({ [ACCESS_TOKEN_COOKIE]: token })

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException)
  })

  it('ignores a refresh cookie sitting alongside a missing access cookie', async () => {
    const token = await jwt.signAsync({ sub: 'user-1', type: 'refresh' } satisfies TokenPayload, { expiresIn: 604800 })
    const { context } = contextWithCookies({ [REFRESH_TOKEN_COOKIE]: token })

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException)
  })

  it('rejects a tampered token', async () => {
    const token = await jwt.signAsync({ sub: 'user-1', type: 'access' } satisfies TokenPayload, { expiresIn: 60 })
    const [header, payload] = token.split('.')
    const { context } = contextWithCookies({ [ACCESS_TOKEN_COOKIE]: `${header}.${payload}.forged-signature` })

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException)
  })
})
