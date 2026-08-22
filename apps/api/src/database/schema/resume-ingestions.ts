import { RESUME_INGESTION_STATUSES } from '@cv-jobs-compatibility/constants'
import { index, integer, pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { users } from './users'

/** The browser renders these too, so the list is shared rather than declared here. */
export const ingestionStatus = pgEnum('ingestion_status', RESUME_INGESTION_STATUSES)

/**
 * One uploaded file and its pipeline state. This is what the client polls.
 *
 * A row appears only once the object is in storage - see DECISIONS.md for why
 * nothing is recorded before that.
 */
export const resumeIngestions = pgTable(
  'resume_ingestions',
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    /** Unique, so the same object cannot be registered twice. */
    storageKey: text().notNull().unique(),
    /** As the user named it, for display. Never used to build the key. */
    filename: text().notNull(),
    contentType: text().notNull(),
    sizeBytes: integer().notNull(),
    status: ingestionStatus().notNull().default('uploaded'),
    /** Set on `failed` only. A rejection's reason belongs to the extraction. */
    failureReason: text(),
    /** The pg-boss job, for tracing. Not a foreign key - another schema owns it. */
    jobId: uuid(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
    /** When it reached a terminal status, whichever one. */
    completedAt: timestamp({ withTimezone: true }),
  },
  (table) => [index('resume_ingestions_user_idx').on(table.userId, table.createdAt)],
)

export type ResumeIngestionRow = typeof resumeIngestions.$inferSelect
export type NewResumeIngestion = typeof resumeIngestions.$inferInsert
