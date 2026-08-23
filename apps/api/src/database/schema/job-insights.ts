import {
  FLAG_CATEGORIES,
  FLAG_POLARITIES,
  FLAG_SOURCE_KINDS,
  INTERVIEW_PROCESS_BASES,
  type InterviewQuestionCategory,
} from '@cv-jobs-compatibility/constants'
import { index, integer, jsonb, pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { jobs } from './jobs'

/**
 * The second, inferential call: what to know about this role beyond what it
 * asks for.
 *
 * Kept apart from extraction because the two prompts contradict each other.
 * Extraction is told to copy and never infer; this is told to reason past the
 * document. Asking one model to do both in one response is how a careful
 * extraction turns into a creative one.
 *
 * Advisory, and it fails softly: a posting whose insights never arrive is still
 * parsed, still scoreable, still complete enough to apply for.
 */

/** What the model believes about the company, and never a claim it can check. */
export interface JobCompanyFacts {
  /**
   * False is the useful answer and the one that has to be easy to give. This
   * comes from training data, not from a lookup, so a forty-person startup is
   * a company the model will invent a history for unless saying so is an
   * option. Anything here is unverified and the UI has to say so.
   */
  known: boolean
  whatTheyDo: string | null
  sector: string | null
  sizeEstimate: string | null
}

export interface JobInterviewStage {
  stage: string
  whatTheyAssess: string
  /** As the posting stated it, or a typical figure. Free text: "45 minutes". */
  typicalDuration: string | null
}

export interface JobInterviewQuestion {
  question: string
  /** What the interviewer is actually testing, which is the useful half. */
  whatTheyAreProbing: string
  category: InterviewQuestionCategory
}

export const interviewProcessBasis = pgEnum('interview_process_basis', INTERVIEW_PROCESS_BASES)

/**
 * One row per posting, replaced when the call is re-run.
 *
 * Deliberately unlike `job_extractions`, which keeps every attempt: comparing
 * two versions of a guess is worth less than the table it would cost, and
 * nothing downstream is built on this the way scoring is built on extraction.
 * `promptVersion` still records which version wrote what is here.
 */
export const jobInsights = pgTable('job_insights', {
  jobId: uuid()
    .primaryKey()
    .references(() => jobs.id, { onDelete: 'cascade' }),
  model: text().notNull(),
  /** A label like `job-insights-v1`. */
  promptVersion: text().notNull(),
  companyFacts: jsonb().$type<JobCompanyFacts>(),
  /** Whether the stages below were read off the posting or guessed from the
   * role type. The reader is entitled to know which. */
  interviewBasis: interviewProcessBasis(),
  interviewStages: jsonb().$type<JobInterviewStage[]>(),
  /** Five, job-scoped. The three tailored to a person live on their match. */
  interviewQuestions: jsonb().$type<JobInterviewQuestion[]>(),
  /** Exactly what came back, before any interpretation. */
  rawResponse: jsonb().notNull(),
  inputTokens: integer(),
  outputTokens: integer(),
  latencyMs: integer(),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
})

export const flagPolarity = pgEnum('flag_polarity', FLAG_POLARITIES)
export const flagCategory = pgEnum('flag_category', FLAG_CATEGORIES)
export const flagSourceKind = pgEnum('flag_source_kind', FLAG_SOURCE_KINDS)

/**
 * Things worth knowing before applying: warnings, draws, and plain facts.
 *
 * Rows rather than another blob on the insights above, because "show me the
 * ones without red flags" is a filter someone will want and a jsonb array is
 * the wrong shape for it.
 *
 * `evidence` is the load-bearing column. Every flag quotes the line of the
 * posting that produced it, which keeps this grounded in a document we have
 * rather than in what a model half-remembers about an employer - the
 * difference between "no salary band, and the advert asks for five years at
 * junior rates" and a libel.
 *
 * Hangs off the job rather than the insights row so a re-run replaces flags
 * wholesale, the same way re-extraction replaces requirements.
 */
export const jobFlags = pgTable(
  'job_flags',
  {
    id: uuid().primaryKey().defaultRandom(),
    jobId: uuid()
      .notNull()
      .references(() => jobs.id, { onDelete: 'cascade' }),
    orderIndex: integer().notNull(),
    polarity: flagPolarity().notNull(),
    category: flagCategory().notNull(),
    text: text().notNull(),
    /**
     * The words this was read out of - a line of the advert, or what somebody
     * actually wrote in a review. Null only where the flag is about an absence:
     * no salary band, no process described.
     */
    evidence: text(),
    /** Read off the advert, or said by somebody elsewhere. */
    sourceKind: flagSourceKind().notNull().default('posting'),
    /**
     * Who said it - "Glassdoor review", "former engineer on Reddit". Null for
     * a posting flag, where the advert is obviously the source.
     *
     * These three columns exist because an unattributed claim about a real
     * employer is worthless and possibly libellous, while "a review from March
     * 2024 said this, here is where" is something a reader can go and check.
     */
    sourceLabel: text(),
    sourceUrl: text(),
    /** As reported, e.g. "March 2024". Text, because a half-remembered date
     * should stay half a date rather than become a confident one. */
    sourceDate: text(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('job_flags_job_idx').on(table.jobId, table.orderIndex)],
)

export type JobInsightsRow = typeof jobInsights.$inferSelect
export type NewJobInsights = typeof jobInsights.$inferInsert
export type JobFlagRow = typeof jobFlags.$inferSelect
export type NewJobFlag = typeof jobFlags.$inferInsert
