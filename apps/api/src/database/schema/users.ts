import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'

/**
 * Application accounts.
 *
 * Deliberately minimal: everything here is needed to authenticate someone or to
 * show who they are. Profile detail, verification state and roles are left out
 * until something actually needs them.
 *
 * Column names come out snake_case from the `casing` option set on both the
 * runtime client and drizzle-kit, so the properties stay camelCase here.
 */
export const users = pgTable('users', {
  id: uuid().primaryKey().defaultRandom(),
  /** Stored lower-cased and trimmed, so the unique index is what enforces
   * "one account per address" rather than a case-sensitive near-miss. */
  email: text().notNull().unique(),
  /** argon2id digest. The plaintext password never leaves the request. */
  passwordHash: text().notNull(),
  name: text().notNull(),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true })
    .notNull()
    .defaultNow()
    // Maintained by Drizzle on update; a trigger would also cover writes made
    // outside the app, which nothing does yet.
    .$onUpdate(() => new Date()),
})

/** A row as it comes back from a select. Includes `passwordHash` - see
 * `toUserModel` for the shape that is safe to hand to a client. */
export type UserRow = typeof users.$inferSelect

export type NewUser = typeof users.$inferInsert
