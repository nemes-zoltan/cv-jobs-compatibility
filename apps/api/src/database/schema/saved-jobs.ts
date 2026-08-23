import { index, pgTable, primaryKey, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { jobs } from './jobs'
import { users } from './users'

/**
 * Which postings are on whose list.
 *
 * The only place a job meets a user. `jobs` holds the advert, this holds the
 * interest in it - so removing one from your list deletes a row here and never
 * touches the posting, which somebody else may be tracking.
 *
 * A posting nobody has saved is unreachable and eventually garbage. Nothing
 * collects it yet: the intended sweep deletes jobs with no savers and no recent
 * activity, and the recency bound is load-bearing the same way it is for
 * orphaned storage objects - without it the sweep eats a posting whose first
 * save is still in flight.
 */
export const savedJobs = pgTable(
  'saved_jobs',
  {
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    jobId: uuid()
      .notNull()
      .references(() => jobs.id, { onDelete: 'cascade' }),
    /**
     * Where this person found it. On the save rather than the posting because
     * two people can reach one advert by two URLs - a job board and the
     * company's own site - and neither is more correct. Never fetched; it is
     * there so a page can link back.
     */
    sourceUrl: text(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.jobId] }),
    index('saved_jobs_user_idx').on(table.userId, table.createdAt),
  ],
)

export type SavedJobRow = typeof savedJobs.$inferSelect
export type NewSavedJob = typeof savedJobs.$inferInsert
