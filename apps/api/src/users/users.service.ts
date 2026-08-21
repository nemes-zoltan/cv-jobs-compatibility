import { ConflictException, Inject, Injectable } from '@nestjs/common'
import { eq } from 'drizzle-orm'
import { DRIZZLE } from '../database/database.constants'
import type { Database } from '../database/database.module'
import { UserRow, users } from '../database/schema/users'

/** Postgres `unique_violation`. */
const UNIQUE_VIOLATION = '23505'

/** Drizzle wraps driver errors, so the `pg` error can sit one level down. */
function isUniqueViolation(error: unknown): boolean {
  const cause = (error as { cause?: unknown } | null)?.cause
  return [error, cause].some((candidate) => (candidate as { code?: string } | null)?.code === UNIQUE_VIOLATION)
}

export interface CreateUserInput {
  email: string
  name: string
  passwordHash: string
}

/**
 * Owns the `users` table. Deals in rows, not in HTTP or tokens - the only thing
 * it knows about the outside world is that a duplicate email is a 409.
 */
@Injectable()
export class UsersService {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  /**
   * Addresses are compared and stored in one canonical form, so `Ada@Example.com`
   * and `ada@example.com` cannot become two accounts.
   */
  static normalizeEmail(email: string): string {
    return email.trim().toLowerCase()
  }

  async findByEmail(email: string): Promise<UserRow | undefined> {
    const [user] = await this.db
      .select()
      .from(users)
      .where(eq(users.email, UsersService.normalizeEmail(email)))
      .limit(1)

    return user
  }

  async findById(id: string): Promise<UserRow | undefined> {
    const [user] = await this.db.select().from(users).where(eq(users.id, id)).limit(1)

    return user
  }

  /**
   * Inserts without checking for an existing address first. The unique index is
   * the only reliable arbiter anyway - a read-then-write would still let two
   * simultaneous registrations past - so the constraint is allowed to fire and
   * is translated here.
   */
  async create(input: CreateUserInput): Promise<UserRow> {
    try {
      const [user] = await this.db
        .insert(users)
        .values({
          email: UsersService.normalizeEmail(input.email),
          name: input.name.trim(),
          passwordHash: input.passwordHash,
        })
        .returning()

      return user
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException('An account with this email already exists')
      }
      throw error
    }
  }
}
