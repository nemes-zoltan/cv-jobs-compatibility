import { ExecutionContext, createParamDecorator } from '@nestjs/common'
import { AuthenticatedRequest, AuthenticatedUser } from './authenticated-request'

/**
 * Reads the user that `JwtAuthGuard` attached. Only meaningful on a handler the
 * guard protects; on an unguarded route it hands back `undefined`.
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedUser =>
    context.switchToHttp().getRequest<AuthenticatedRequest>().user,
)
