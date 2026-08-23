import {
  EDUCATION_LEVELS,
  EMPLOYMENT_TYPES,
  JOB_INSIGHTS_STATUSES,
  JOB_STATUSES,
  REQUIREMENT_IMPORTANCE_LEVELS,
  SALARY_PERIODS,
  SENIORITY_LEVELS,
  WORK_MODES,
} from '@cv-jobs-compatibility/constants'
import { index, jsonb, numeric, pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { jobExtractions } from './job-extractions'

/**
 * Enums the job tables share. Declared here because `jobs` is the table they
 * all hang off; `requirementImportance` is used by both this table's education
 * requirement and the requirement rows themselves.
 */
export const jobStatus = pgEnum('job_status', JOB_STATUSES)
export const jobInsightsStatus = pgEnum('job_insights_status', JOB_INSIGHTS_STATUSES)
export const workMode = pgEnum('work_mode', WORK_MODES)
export const employmentType = pgEnum('employment_type', EMPLOYMENT_TYPES)
export const seniorityLevel = pgEnum('seniority_level', SENIORITY_LEVELS)
export const salaryPeriod = pgEnum('salary_period', SALARY_PERIODS)
export const educationLevel = pgEnum('education_level', EDUCATION_LEVELS)
export const requirementImportance = pgEnum('requirement_importance', REQUIREMENT_IMPORTANCE_LEVELS)

/**
 * A job posting. Belongs to nobody.
 *
 * The deliberate absence here is `userId`: a posting is a fact about the world,
 * not about an account, so two people who paste the same advert share one row
 * and the second pays for no model call. `saved_jobs` carries who wants it, and
 * a match is a statement about a posting and a CV rather than about a user.
 *
 * Unlike a resume, the row is written before anything is known about it - the
 * pasted text is the artefact, so there is no half-created upload to avoid and
 * a list can show "parsing" the moment someone submits. Everything below
 * `queueJobId` is therefore null until an extraction succeeds.
 */
export const jobs = pgTable(
  'jobs',
  {
    id: uuid().primaryKey().defaultRandom(),
    /**
     * sha256 of the text with whitespace normalised, and the whole basis of
     * sharing: paste the same advert twice and the second returns the first.
     * Only catches exact reposts - two people copying different amounts of the
     * same page produce two rows, which is accepted.
     */
    contentHash: text().notNull().unique(),
    status: jobStatus().notNull().default('queued'),
    /** A code the browser maps to wording, set on `failed` only. A rejection's
     * reason belongs to the extraction that decided it. */
    failureReason: text(),
    /** Which run produced the columns below. Null until one has. */
    extractionId: uuid().references(() => jobExtractions.id, { onDelete: 'set null' }),
    /** Advisory, and tracked apart so a failure here cannot hold a posting back. */
    insightsStatus: jobInsightsStatus().notNull().default('pending'),
    /** The pg-boss job, for tracing. Not called `jobId` - that would read as a
     * self-reference in this table of all tables. */
    queueJobId: uuid(),

    // The extracted posting. All nullable: an advert need not name a salary, a
    // location, or anything else, and a null is how we say it did not.
    title: text(),
    company: text(),
    /** Adverts routinely list several, and "which one is nearest" is a real question. */
    locations: text().array(),
    workMode: workMode(),
    employmentType: employmentType(),
    seniority: seniorityLevel(),
    yearsExperienceMin: numeric({ precision: 4, scale: 1 }),
    yearsExperienceMax: numeric({ precision: 4, scale: 1 }),
    salaryMin: numeric({ precision: 12, scale: 2 }),
    salaryMax: numeric({ precision: 12, scale: 2 }),
    /** ISO 4217, as written in the advert. */
    salaryCurrency: text(),
    salaryPeriod: salaryPeriod(),
    /** e.g. "fintech". Same stack in a different domain is a real misalignment,
     * and without this the model would re-derive it from raw text every time. */
    industry: text(),
    /** What the team builds, its size, its stack - the material an interview
     * answer is made of, which requirements alone do not provide. */
    teamContext: text(),
    /**
     * What the role does day to day, as written.
     *
     * Kept apart from the requirement rows because it answers a different
     * question: requirements are what you must already have, these are what you
     * would be doing, and only the first is something to be graded against.
     */
    responsibilities: text().array(),
    /** The model's own two or three sentences. The only generative field in the
     * extraction, and what a card shows instead of the whole advert. */
    summary: text(),
    educationLevel: educationLevel(),
    educationField: text(),
    educationImportance: requirementImportance(),
    /** Benefits, perks, anything extracted but not yet queried structurally.
     * Promoting one to a column later is a migration over data already here. */
    extras: jsonb(),

    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
    /** When it reached a terminal status, whichever one. */
    completedAt: timestamp({ withTimezone: true }),
  },
  (table) => [index('jobs_status_idx').on(table.status, table.createdAt)],
)

export type JobRow = typeof jobs.$inferSelect
export type NewJob = typeof jobs.$inferInsert
