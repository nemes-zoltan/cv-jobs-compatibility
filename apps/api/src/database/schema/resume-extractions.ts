import { boolean, index, integer, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { resumeIngestions } from './resume-ingestions'

/**
 * One row per LLM attempt, successful or not.
 *
 * Written the moment the model answers and before anything is normalised, so a
 * failure while inserting the resume can be retried without paying for the call
 * again. Keeping every attempt is also what makes a prompt change reviewable:
 * the same file can be re-run and the two rows compared.
 */
export const resumeExtractions = pgTable(
  'resume_extractions',
  {
    id: uuid().primaryKey().defaultRandom(),
    ingestionId: uuid()
      .notNull()
      .references(() => resumeIngestions.id, { onDelete: 'cascade' }),
    model: text().notNull(),
    /** A label like `resume-extract-v3`, matching the constant in the code. */
    promptVersion: text().notNull(),
    /** The model's verdict on whether this document is a CV at all. */
    isValid: boolean().notNull(),
    /** Why it is not a CV. Set when `isValid` is false. */
    rejectionReason: text(),
    /** Exactly what came back, before any interpretation. */
    rawResponse: jsonb().notNull(),
    inputTokens: integer(),
    outputTokens: integer(),
    latencyMs: integer(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('resume_extractions_ingestion_idx').on(table.ingestionId, table.createdAt)],
)

export type ResumeExtractionRow = typeof resumeExtractions.$inferSelect
export type NewResumeExtraction = typeof resumeExtractions.$inferInsert
