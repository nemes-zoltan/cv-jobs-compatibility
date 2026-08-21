/**
 * Domain shapes shared by the API and its clients.
 *
 * These describe data as it travels over the wire, which is why timestamps are
 * ISO-8601 strings rather than `Date`: JSON has no date type, so a client that
 * parses a response holds a string no matter what the server used internally.
 * The API converts at its boundary.
 */

/**
 * A user account as any client is allowed to see it.
 *
 * Deliberately not the database row - the password hash has no representation
 * here, so it cannot leak by being forwarded.
 */
export interface UserModel {
  id: string
  email: string
  name: string
  /** ISO-8601, e.g. `2026-08-21T09:30:00.000Z`. */
  createdAt: string
}
