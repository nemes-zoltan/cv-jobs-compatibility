/**
 * Domain shapes shared by the API and its clients.
 *
 * These describe data as it travels over the wire, which is why timestamps are
 * ISO-8601 strings rather than `Date`: JSON has no date type, so a client that
 * parses a response holds a string no matter what the server used internally.
 * The API converts at its boundary.
 */

import type { ResumeIngestionStatus, SkillCategory } from '@cv-jobs-compatibility/constants'

/**
 * A user account as any client is allowed to see it.
 *
 * Deliberately not the database row - the password hash has no representation
 * here, so it cannot leak by being forwarded.
 */
export interface UserModel {
  id: string
  email: string
  name: string
  /** ISO-8601, e.g. `2026-08-21T09:30:00.000Z`. */
  createdAt: string
  /**
   * Whether a CV has made it all the way through the pipeline.
   *
   * Read from the `resumes` table on every request rather than stored on the
   * account: the row appears in a worker, not in a request, so a column here
   * would be written by something the user never talks to and wrong whenever
   * that failed. It decides which screen the app opens on.
   */
  hasResume: boolean
}

/**
 * An uploaded file and where its processing has got to.
 *
 * What the client polls. Carries no storage key and no failure detail: the key
 * is an implementation detail of the API, and the reason a file was rejected is
 * written by a language model against a document the user supplied, so it never
 * reaches a page unedited.
 */
/**
 * A parsed CV, as a page renders it.
 *
 * Dates are the strings the document itself used - "Jan 2019", "Present",
 * "Summer 2020". The normalised dates stay on the server for sorting and
 * comparison; showing them instead would turn "2019" into a confident first of
 * January and lose everything the parser could not read.
 */
export interface ResumeModel {
  id: string
  fullName: string | null
  email: string | null
  phone: string | null
  location: string | null
  headline: string | null
  summary: string | null
  /** The model's estimate, to one decimal place. */
  yearsExperienceTotal: number | null
  links: ResumeLinkModel[]
  certifications: string[]
  languages: string[]
  experiences: ResumeExperienceModel[]
  education: ResumeEducationModel[]
  skills: ResumeSkillModel[]
  projects: ResumeProjectModel[]
  createdAt: string
}

export interface ResumeLinkModel {
  /** Null when the document showed a bare URL. */
  label: string | null
  url: string
}

export interface ResumeExperienceModel {
  id: string
  company: string
  title: string
  location: string | null
  /** As written on the CV. */
  start: string | null
  end: string | null
  isCurrent: boolean
  summary: string | null
  highlights: string[]
}

export interface ResumeEducationModel {
  id: string
  institution: string
  degree: string | null
  field: string | null
  start: string | null
  end: string | null
  grade: string | null
}

export interface ResumeSkillModel {
  id: string
  name: string
  category: SkillCategory
}

export interface ResumeProjectModel {
  id: string
  name: string
  description: string | null
  technologies: string[]
  url: string | null
  start: string | null
  end: string | null
}

export interface ResumeIngestionModel {
  id: string
  status: ResumeIngestionStatus
  /** As the user named it. */
  filename: string
  createdAt: string
  /** When the status last changed. What "stalled" is measured against. */
  updatedAt: string
  /** ISO-8601 once the status is terminal, null while it is still moving. */
  completedAt: string | null
}
