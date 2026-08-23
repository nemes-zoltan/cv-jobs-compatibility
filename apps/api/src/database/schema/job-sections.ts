import { REQUIREMENT_KINDS } from '@cv-jobs-compatibility/constants'
import { index, integer, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core'
import { jobs, requirementImportance } from './jobs'
import { skillCategory } from './resume-sections'

/**
 * What a posting asks for, one row at a time.
 *
 * Two tables in one file because they are the same idea at two altitudes and
 * always change together: a skill is a thing you either have or you do not, a
 * requirement is a sentence someone has to be graded against. Splitting them is
 * what lets the deterministic half stay deterministic - a skill gap is a set
 * difference, "led a team through a migration" never will be.
 *
 * Both are replaced wholesale when a posting is re-extracted, which is why
 * neither carries state of its own. Anything derived from them - a stored
 * match - has to go at the same time, since it was graded against rows that no
 * longer exist.
 */

const jobChild = {
  id: uuid().primaryKey().defaultRandom(),
  jobId: uuid()
    .notNull()
    .references(() => jobs.id, { onDelete: 'cascade' }),
  /** Position in the advert, so it can be rendered back in its own order. */
  orderIndex: integer().notNull(),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
}

export const requirementKind = pgEnum('requirement_kind', REQUIREMENT_KINDS)

/**
 * One thing the posting wants, as its own graded line.
 *
 * `text` is the short canonical phrase and `originalText` the bullet as
 * written. Adverts pad - "you have 5+ years building scalable systems in a
 * fast-paced environment" is one signal wrapped in filler - and the filler is
 * what a grader would otherwise be reading. Keeping the original alongside is
 * what makes a bad condensation visible instead of silent.
 */
export const jobRequirements = pgTable(
  'job_requirements',
  {
    ...jobChild,
    text: text().notNull(),
    /** Null when the model found nothing worth trimming. */
    originalText: text(),
    importance: requirementImportance().notNull(),
    kind: requirementKind().notNull(),
  },
  (table) => [index('job_requirements_job_idx').on(table.jobId, table.orderIndex)],
)

/**
 * A named skill the posting asks for.
 *
 * `skillCategory` and `normalizedName` are shared with `resume_skills` on
 * purpose - both sides of a comparison have to speak one vocabulary and be
 * lowercased by the same function, or the cheap half of matching quietly stops
 * working.
 *
 * No `yearsExperience` here, unlike the resume side. A CV does not record how
 * long anyone used a tool, so "3+ years of React" cannot be checked as a
 * property of a skill; it is a requirement row, and it gets graded like one.
 */
export const jobSkills = pgTable(
  'job_skills',
  {
    ...jobChild,
    name: text().notNull(),
    /** Lowercased, trimmed, punctuation stripped - the same transform as the CV. */
    normalizedName: text().notNull(),
    category: skillCategory().notNull().default('other'),
    importance: requirementImportance().notNull(),
  },
  (table) => [
    index('job_skills_job_idx').on(table.jobId),
    // One row per skill per posting, so an advert naming Kubernetes in three
    // sections does not weight the comparison three times.
    uniqueIndex('job_skills_unique_per_job').on(table.jobId, table.normalizedName),
  ],
)

export type JobRequirementRow = typeof jobRequirements.$inferSelect
export type NewJobRequirement = typeof jobRequirements.$inferInsert
export type JobSkillRow = typeof jobSkills.$inferSelect
export type NewJobSkill = typeof jobSkills.$inferInsert
