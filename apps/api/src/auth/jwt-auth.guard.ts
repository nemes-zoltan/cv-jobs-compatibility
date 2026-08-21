import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common'
import { ACCESS_TOKEN_COOKIE } from './auth-cookies'
import { AuthService } from './auth.service'
import { AuthenticatedRequest } from './authenticated-request'

/**
 * Verifies the access token cookie and attaches the caller to the request.
 *
 * Signature and expiry are the whole check - no database round trip - which is
 * what keeps a guarded endpoint cheap enough to poll. The price is that an
 * access token stays usable until it expires, which is why it is short-lived.
 *
 * Written by hand rather than through Passport: with a single strategy, the
 * strategy abstraction is three dependencies of indirection around the ten
 * lines below.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>()
    const token = request.cookies?.[ACCESS_TOKEN_COOKIE] as string | undefined

    // Throws UnauthorizedException on anything it does not like.
    const { sub } = await this.authService.verifyToken(token, 'access')
    request.user = { id: sub }

    return true
  }
}
