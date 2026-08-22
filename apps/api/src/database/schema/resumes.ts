import { sql } from 'drizzle-orm'
import {
  boolean,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'
import { resumeExtractions } from './resume-extractions'
import { resumeIngestions } from './resume-ingestions'
import { users } from './users'

/** Whatever the CV listed: GitHub, LinkedIn, a portfolio. */
export interface ResumeLink {
  /** Null when the document showed a bare URL with nothing naming it. */
  label: string | null
  url: string
}

/**
 * A parsed CV.
 *
 * A row exists here only if the model confirmed the document was a CV, so
 * everything downstream can read this table without filtering on a status.
 *
 * The id is the ingestion's id rather than its own: one file, one resume. That
 * lets the client poll an ingestion and then fetch the resume under the same
 * id, and it assumes re-extraction replaces rather than versions.
 */
export const resumes = pgTable(
  'resumes',
  {
    id: uuid()
      .primaryKey()
      .references(() => resumeIngestions.id, { onDelete: 'cascade' }),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    /** Which model run produced these rows. */
    extractionId: uuid()
      .notNull()
      .references(() => resumeExtractions.id),
    /** The one scored against job postings. Enforced unique per user below. */
    isActive: boolean().notNull().default(false),

    // Everything below is the model's reading of the document, so all of it is
    // nullable - a CV need not state a phone number, or anything else.
    fullName: text(),
    email: text(),
    phone: text(),
    location: text(),
    headline: text(),
    summary: text(),
    /** Estimated, and fractional: half a year is a meaningful difference. */
    yearsExperienceTotal: numeric({ precision: 4, scale: 1 }),
    links: jsonb().$type<ResumeLink[]>(),
    /**
     * Certifications, languages, awards, publications - anything extracted but
     * not yet queried structurally. Promoting one to its own table later is a
     * migration over data already here.
     */
    extras: jsonb(),

    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    // Partial, so any number of inactive resumes can sit alongside the one
    // active. The database is what guarantees there is never a second.
    uniqueIndex('resumes_one_active_per_user')
      .on(table.userId)
      .where(sql`${table.isActive}`),
  ],
)

export type ResumeRow = typeof resumes.$inferSelect
export type NewResume = typeof resumes.$inferInsert
