import {
  GAP_TYPES,
  MATCH_RECOMMENDATIONS,
  MATCH_STATUSES,
  MATCH_VERDICTS,
  SKILL_VERDICTS,
  type MatchEssentialCheck,
  type MatchEssentialVerdict,
} from '@cv-jobs-compatibility/constants'
import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'
import { jobRequirements, jobSkills } from './job-sections'
import { jobs } from './jobs'
import { resumes } from './resumes'

/**
 * One CV graded against one posting.
 *
 * Keyed on the resume rather than the user, which is what makes invalidation
 * free: a resume row is immutable in practice, so a new CV is a new id, no
 * match exists for it, and the score is recomputed without anyone having to
 * remember an invalidation rule. Keying on the account would need one, and it
 * would be wrong the first time somebody re-uploaded.
 *
 * The model never returns the score. It grades each requirement and each skill
 * and those judgements are rows; `score` is our arithmetic over them. That is
 * the whole design: re-weighting the formula is a recalculation, asking a model
 * for a better number is a re-run, and only one of those is free.
 *
 * Derived data, and stale the moment its posting is re-extracted - the rubric
 * it was graded against no longer exists, so those matches are deleted rather
 * than repaired.
 */

export const matchStatus = pgEnum('match_status', MATCH_STATUSES)
export const matchVerdict = pgEnum('match_verdict', MATCH_VERDICTS)
export const matchRecommendation = pgEnum('match_recommendation', MATCH_RECOMMENDATIONS)
export const skillVerdict = pgEnum('skill_verdict', SKILL_VERDICTS)
export const gapType = pgEnum('gap_type', GAP_TYPES)
// The essential verdicts stay a TypeScript union: they live inside the jsonb
// blob below, so a Postgres type would be one nothing could ever be declared as.

/** The judged essentials. Few, fixed, and never aggregated, so one blob. */
export interface MatchEssential {
  check: MatchEssentialCheck
  verdict: MatchEssentialVerdict
  /** One sentence. Mostly used to explain an `unknown`. */
  note: string | null
}

export interface MatchTailoredQuestion {
  question: string
  /** The gap or strength that makes this one likely. A question with nothing
   * behind it is a generic question, which is worth nothing. */
  motivatedBy: string
  howToApproach: string
}

export const jobMatches = pgTable(
  'job_matches',
  {
    id: uuid().primaryKey().defaultRandom(),
    jobId: uuid()
      .notNull()
      .references(() => jobs.id, { onDelete: 'cascade' }),
    resumeId: uuid()
      .notNull()
      .references(() => resumes.id, { onDelete: 'cascade' }),
    status: matchStatus().notNull().default('queued'),
    failureReason: text(),

    /** 0-100, weighted over the rows below. Ours, not the model's. */
    score: integer(),
    verdict: matchVerdict(),
    recommendation: matchRecommendation(),
    /**
     * Arithmetic, not judgement: both sides of this comparison are numbers in
     * columns, so nobody should be paying a model to subtract them. Null when
     * either side is silent.
     */
    meetsYearsRequirement: boolean(),
    essentials: jsonb().$type<MatchEssential[]>(),

    /**
     * Written after the row judgements in the same response, and permitted to
     * reference only those - the response schema orders them that way, so the
     * prose is generated conditioned on ratings already committed to. Without
     * that, a summary calling someone a strong fit sits happily beside a
     * one-star row saying otherwise.
     */
    summary: text(),
    strengths: text().array(),
    gaps: text().array(),
    tailoredQuestions: jsonb().$type<MatchTailoredQuestion[]>(),

    model: text(),
    promptVersion: text(),
    rawResponse: jsonb(),
    inputTokens: integer(),
    outputTokens: integer(),
    latencyMs: integer(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
    completedAt: timestamp({ withTimezone: true }),
  },
  (table) => [
    uniqueIndex('job_matches_unique_per_resume').on(table.jobId, table.resumeId),
    // The ranked list: one CV's matches, best first.
    index('job_matches_resume_idx').on(table.resumeId, table.score),
  ],
)

/**
 * How the CV did on one requirement.
 *
 * Stars because a requirement is a matter of degree, with anchors written into
 * the prompt - a bare 1-5 makes a model hedge at three or four on everything.
 * `evidence` is what makes the rating checkable, and asking for it is also what
 * stops a generous rating with nothing behind it.
 */
export const jobMatchRequirements = pgTable(
  'job_match_requirements',
  {
    id: uuid().primaryKey().defaultRandom(),
    matchId: uuid()
      .notNull()
      .references(() => jobMatches.id, { onDelete: 'cascade' }),
    requirementId: uuid()
      .notNull()
      .references(() => jobRequirements.id, { onDelete: 'cascade' }),
    /** 1-5. 1 is no evidence, 5 is exceeds it with something specific. */
    stars: smallint().notNull(),
    /** The role or line of the CV this was read off. Null when there is none. */
    evidence: text(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('job_match_requirements_match_idx').on(table.matchId)],
)

/**
 * Whether the CV shows one skill the posting asks for.
 *
 * A separate table from the requirement judgements rather than one table with a
 * discriminator, because the shapes genuinely differ and because this is the
 * one that gets aggregated: "Kubernetes is missing from seven of your twelve
 * saved jobs" is a group-by over these rows, and it is worth more than any
 * amount of scoring sophistication.
 */
export const jobMatchSkills = pgTable(
  'job_match_skills',
  {
    id: uuid().primaryKey().defaultRandom(),
    matchId: uuid()
      .notNull()
      .references(() => jobMatches.id, { onDelete: 'cascade' }),
    skillId: uuid()
      .notNull()
      .references(() => jobSkills.id, { onDelete: 'cascade' }),
    verdict: skillVerdict().notNull(),
    /** How far off it is. Set only where the verdict is not `yes`. */
    gapType: gapType(),
    evidence: text(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('job_match_skills_match_idx').on(table.matchId)],
)

export type JobMatchRow = typeof jobMatches.$inferSelect
export type NewJobMatch = typeof jobMatches.$inferInsert
export type JobMatchRequirementRow = typeof jobMatchRequirements.$inferSelect
export type NewJobMatchRequirement = typeof jobMatchRequirements.$inferInsert
export type JobMatchSkillRow = typeof jobMatchSkills.$inferSelect
export type NewJobMatchSkill = typeof jobMatchSkills.$inferInsert
