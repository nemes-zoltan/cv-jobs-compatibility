import { integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { resumeIngestions } from './resume-ingestions'

/**
 * Text pulled out of the file, before anything knows whether it is a CV.
 *
 * Kept apart from both `resume_ingestions` and `resumes` because it is large
 * and almost never wanted: the poll endpoint reads the ingestion once a second,
 * and a resume list reads every resume. Neither should carry this along.
 *
 * Belongs to the ingestion rather than the resume so a rejected upload keeps
 * its text - which is what you need to work out why it was rejected.
 */
export const resumeTexts = pgTable('resume_texts', {
  ingestionId: uuid()
    .primaryKey()
    .references(() => resumeIngestions.id, { onDelete: 'cascade' }),
  content: text().notNull(),
  charCount: integer().notNull(),
  /** PDF only; null for formats without pages. */
  pageCount: integer(),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
})

export type ResumeTextRow = typeof resumeTexts.$inferSelect
export type NewResumeText = typeof resumeTexts.$inferInsert
