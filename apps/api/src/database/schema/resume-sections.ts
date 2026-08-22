import { SKILL_CATEGORIES } from '@cv-jobs-compatibility/constants'
import { boolean, date, index, integer, numeric, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core'
import { resumes } from './resumes'

/**
 * The repeating parts of a CV.
 *
 * Four tables in one file because they share a shape - a child of `resumes`
 * with an `orderIndex` - and always change together.
 *
 * Dates on a CV are written for humans ("2019 - present", "Jan '20"), so each
 * one is stored twice: the string as written, and a normalised date that is
 * null when it could not be parsed. Losing what the document actually said
 * would make a bad parse impossible to diagnose.
 *
 * A re-extraction replaces these rows wholesale, which is why nothing here
 * carries state of its own.
 */

const orderedChild = {
  id: uuid().primaryKey().defaultRandom(),
  resumeId: uuid()
    .notNull()
    .references(() => resumes.id, { onDelete: 'cascade' }),
  /** Position in the document, so the CV can be rendered back in its own order. */
  orderIndex: integer().notNull(),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
}

export const resumeExperiences = pgTable(
  'resume_experiences',
  {
    ...orderedChild,
    company: text().notNull(),
    title: text().notNull(),
    location: text(),
    startDateRaw: text(),
    endDateRaw: text(),
    startDate: date(),
    endDate: date(),
    isCurrent: boolean().notNull().default(false),
    summary: text(),
    /** The bullet points, kept as written. */
    highlights: text().array(),
  },
  (table) => [index('resume_experiences_resume_idx').on(table.resumeId, table.orderIndex)],
)

export const resumeEducation = pgTable(
  'resume_education',
  {
    ...orderedChild,
    institution: text().notNull(),
    degree: text(),
    field: text(),
    startDateRaw: text(),
    endDateRaw: text(),
    startDate: date(),
    endDate: date(),
    grade: text(),
  },
  (table) => [index('resume_education_resume_idx').on(table.resumeId, table.orderIndex)],
)

/**
 * Deliberately not a foreign key into a shared skills dictionary.
 *
 * "React", "React.js" and "ReactJS" do not reconcile lexically, and a dictionary
 * that gets it wrong is worse than none. `normalizedName` exists so both sides
 * of a comparison are lowercased and stripped the same way; the actual matching
 * against a job posting happens semantically, not by string equality.
 *
 * The categories come from the shared constant the extraction schema also uses,
 * so the model can never return one this column would reject.
 */
export const skillCategory = pgEnum('skill_category', SKILL_CATEGORIES)

export const resumeSkills = pgTable(
  'resume_skills',
  {
    ...orderedChild,
    name: text().notNull(),
    /** Lowercased, trimmed, punctuation stripped. Anything unrecognised is `other`. */
    normalizedName: text().notNull(),
    category: skillCategory().notNull().default('other'),
    yearsExperience: numeric({ precision: 4, scale: 1 }),
  },
  (table) => [
    index('resume_skills_resume_idx').on(table.resumeId),
    // One row per skill per resume, so a CV listing "React" three times does not
    // weight the comparison three times.
    uniqueIndex('resume_skills_unique_per_resume').on(table.resumeId, table.normalizedName),
  ],
)

export const resumeProjects = pgTable(
  'resume_projects',
  {
    ...orderedChild,
    name: text().notNull(),
    description: text(),
    technologies: text().array(),
    url: text(),
    startDateRaw: text(),
    endDateRaw: text(),
    startDate: date(),
    endDate: date(),
  },
  (table) => [index('resume_projects_resume_idx').on(table.resumeId, table.orderIndex)],
)

export type ResumeExperienceRow = typeof resumeExperiences.$inferSelect
export type NewResumeExperience = typeof resumeExperiences.$inferInsert
export type ResumeEducationRow = typeof resumeEducation.$inferSelect
export type NewResumeEducation = typeof resumeEducation.$inferInsert
export type ResumeSkillRow = typeof resumeSkills.$inferSelect
export type NewResumeSkill = typeof resumeSkills.$inferInsert
export type ResumeProjectRow = typeof resumeProjects.$inferSelect
export type NewResumeProject = typeof resumeProjects.$inferInsert
