import type { UserModel } from '@cv-jobs-compatibility/types'
import type { Request } from 'express'

/**
 * What a verified access token tells us about the caller: an id, and nothing
 * else. Anything beyond identity is read from the database at the point of use,
 * so a stale token can never carry a stale name or a revoked permission.
 *
 * Derived from `UserModel` rather than restating `string`, so it follows the
 * shared contract if the identifier ever changes type.
 */
export type AuthenticatedUser = Pick<UserModel, 'id'>

/** A request that has passed `JwtAuthGuard`. */
export interface AuthenticatedRequest extends Request {
  user: AuthenticatedUser
}
