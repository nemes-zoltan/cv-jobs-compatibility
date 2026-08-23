import { boolean, index, integer, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { jobs } from './jobs'

/**
 * One row per attempt at reading a posting, successful or not.
 *
 * The same bargain as `resume_extractions`: written the moment the model
 * answers and before anything is interpreted, so a failure while inserting the
 * requirement rows can be retried without paying for the call again. Keeping
 * every attempt is also what makes a prompt change reviewable - the same text
 * re-run under two versions, side by side.
 *
 * This covers extraction only. The inferential second call keeps its output in
 * `job_insights`, because the two prompts have opposite instructions and
 * versioning them together would mean re-extracting to change a guess.
 */
export const jobExtractions = pgTable(
  'job_extractions',
  {
    id: uuid().primaryKey().defaultRandom(),
    jobId: uuid()
      .notNull()
      .references(() => jobs.id, { onDelete: 'cascade' }),
    model: text().notNull(),
    /** A label like `job-extract-v1`, matching the constant in the code. */
    promptVersion: text().notNull(),
    /** The model's verdict on whether this text is a job posting at all. */
    isValid: boolean().notNull(),
    /** What it appears to be instead. Set when `isValid` is false, and never
     * shown to anyone - it is written about text a stranger supplied. */
    rejectionReason: text(),
    /** Exactly what came back, before any interpretation. */
    rawResponse: jsonb().notNull(),
    inputTokens: integer(),
    outputTokens: integer(),
    latencyMs: integer(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('job_extractions_job_idx').on(table.jobId, table.createdAt)],
)

export type JobExtractionRow = typeof jobExtractions.$inferSelect
export type NewJobExtraction = typeof jobExtractions.$inferInsert
