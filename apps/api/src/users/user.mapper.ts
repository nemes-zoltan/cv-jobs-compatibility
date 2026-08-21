import type { UserModel } from '@cv-jobs-compatibility/types'
import { UserRow } from '../database/schema/users'

/**
 * Converts a database row into the shape clients receive.
 *
 * Every field is named explicitly, and that is the point: spreading the row and
 * deleting `passwordHash` would keep leaking any sensitive column added later,
 * whereas an allow-list stays correct as the table grows.
 *
 * `createdAt` becomes an ISO string here because that is what survives JSON -
 * doing it at the boundary keeps `UserModel` honest about what a client holds.
 */
export function toUserModel(user: UserRow): UserModel {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    createdAt: user.createdAt.toISOString(),
  }
}
