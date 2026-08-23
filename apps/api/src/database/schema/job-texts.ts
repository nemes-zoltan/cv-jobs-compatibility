import { integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { jobs } from './jobs'

/**
 * The advert as it was pasted, before anything knows whether it is one.
 *
 * Split off `jobs` for the same reason `resume_texts` is split off its
 * ingestion: the list query reads every saved posting and the poll reads one
 * repeatedly, and neither should drag twenty kilobytes of "we are an equal
 * opportunity employer" along with it.
 *
 * Kept even when the text turns out not to be a job posting - which is exactly
 * when you want to read it.
 */
export const jobTexts = pgTable('job_texts', {
  jobId: uuid()
    .primaryKey()
    .references(() => jobs.id, { onDelete: 'cascade' }),
  content: text().notNull(),
  charCount: integer().notNull(),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
})

export type JobTextRow = typeof jobTexts.$inferSelect
export type NewJobText = typeof jobTexts.$inferInsert
