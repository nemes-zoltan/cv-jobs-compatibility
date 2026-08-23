/**
 * What a job posting is made of, and the states one moves through.
 *
 * Same rule as `resumes`: every list here is declared once and read by three
 * consumers - Postgres as a `pgEnum`, the extraction schema sent to the model,
 * and the browser rendering the result. A value the model may return is
 * therefore always one the column accepts.
 *
 * Nothing here has an `unspecified` member. A posting that does not say leaves
 * a null column and a null in the model's response; two ways to spell "not
 * stated" is one too many.
 */

/**
 * Below this there is not enough text to be a job advert, and paying a model to
 * confirm that is money spent on nothing. Checked in the browser and again in
 * the API.
 */
export const MIN_JOB_TEXT_CHARS = 200

/**
 * Far above any real advert. Its job is to stop someone pasting a novel into
 * the box and being billed for reading it.
 */
export const MAX_JOB_TEXT_CHARS = 30_000

export const MAX_JOB_SOURCE_URL_LENGTH = 2048

/** Postings per page, and the ceiling a client may ask for. */
export const JOBS_PAGE_SIZE = 12
export const MAX_JOBS_PAGE_SIZE = 50

/**
 * How long a posting may sit without progress before the page stops saying
 * "working" and offers a way out.
 *
 * Has to sit above the retry budget, not above a single attempt: a job that
 * expired and is backing off before its second try is slow, not dead, and
 * calling it dead invites someone to delete a posting that was about to finish.
 *
 * Nothing rewrites the row - this only decides what the browser says, and the
 * same window decides when a re-paste re-queues a posting nobody is working on.
 */
export const STALLED_JOB_SECONDS = 3 * 60

/**
 * The pipeline a pasted posting moves through, in order.
 *
 * Shorter than the resume one because there is no file: the text arrives in the
 * request, so there is nothing to download and nothing to extract before the
 * model sees it.
 *
 * `rejected` and `failed` are both terminal and mean different things - text
 * that is not a job posting, versus our pipeline giving up. One asks for
 * different text, the other for a retry.
 */
export const JOB_STATUSES = ['queued', 'analyzing', 'ready', 'rejected', 'failed'] as const

export type JobStatus = (typeof JOB_STATUSES)[number]

export const TERMINAL_JOB_STATUSES = ['ready', 'rejected', 'failed'] as const

export type TerminalJobStatus = (typeof TERMINAL_JOB_STATUSES)[number]

export function isTerminalJobStatus(status: JobStatus): status is TerminalJobStatus {
  return (TERMINAL_JOB_STATUSES as readonly string[]).includes(status)
}

/**
 * Where the second, inferential call has got to.
 *
 * Tracked apart from `JOB_STATUSES` because insights are advisory: a posting
 * whose insights failed is still fully parsed and fully scoreable, so this must
 * not be able to hold a job back.
 *
 * Three states rather than four - "queued" and "running" both render as "still
 * working" and nothing branches on the difference.
 */
export const JOB_INSIGHTS_STATUSES = ['pending', 'ready', 'failed'] as const

export type JobInsightsStatus = (typeof JOB_INSIGHTS_STATUSES)[number]

export const WORK_MODES = ['onsite', 'hybrid', 'remote'] as const

export type WorkMode = (typeof WORK_MODES)[number]

export const EMPLOYMENT_TYPES = ['full_time', 'part_time', 'contract', 'internship', 'temporary'] as const

export type EmploymentType = (typeof EMPLOYMENT_TYPES)[number]

/**
 * Ladder rungs, ascending. Ordering is the point: comparing a posting's rung
 * against a CV's is most of what "is this a stretch?" means, so the list is
 * read positionally and members must not be reordered casually.
 *
 * `lead`, `manager` and `director` sit above the individual-contributor rungs
 * even though they are a different track, because the only comparison made is
 * "further along than the last role or not".
 */
export const SENIORITY_LEVELS = [
  'intern',
  'junior',
  'mid',
  'senior',
  'staff',
  'principal',
  'lead',
  'manager',
  'director',
] as const

export type SeniorityLevel = (typeof SENIORITY_LEVELS)[number]

export const SALARY_PERIODS = ['hour', 'day', 'month', 'year'] as const

export type SalaryPeriod = (typeof SALARY_PERIODS)[number]

/** Also ascending, and compared against the CV's highest the same way. */
export const EDUCATION_LEVELS = ['high_school', 'associate', 'bachelor', 'master', 'doctorate'] as const

export type EducationLevel = (typeof EDUCATION_LEVELS)[number]

/**
 * How much a posting wants something.
 *
 * Two values, not a weight. Job ads signal "must have" and "nice to have" and
 * nothing finer, so a model asked for a 1-5 importance would be inventing the
 * other three - and the ranking would then be built on the invention.
 */
export const REQUIREMENT_IMPORTANCE_LEVELS = ['required', 'preferred'] as const

export type RequirementImportance = (typeof REQUIREMENT_IMPORTANCE_LEVELS)[number]

/**
 * What kind of thing a requirement asks for.
 *
 * `skill` requirements sit alongside the skill rows rather than replacing them:
 * "React" is a skill, "3+ years of React" is a requirement, and only the second
 * can be graded on a scale. Everything the world throws at us that is none of
 * these - clearances, driving licences, hackathon wins - lands in `other`,
 * which is what keeps the list finite.
 */
export const REQUIREMENT_KINDS = [
  'skill',
  'experience',
  'education',
  'certification',
  'language',
  'eligibility',
  'other',
] as const

export type RequirementKind = (typeof REQUIREMENT_KINDS)[number]

/** Whether a flag is a warning, a plus, or just worth knowing. */
export const FLAG_POLARITIES = ['red', 'green', 'neutral'] as const

export type FlagPolarity = (typeof FLAG_POLARITIES)[number]

/**
 * Where a flag came from.
 *
 * The distinction the reader needs most. A `posting` flag is read off the
 * advert in front of them and quotes it. A `web` flag is something somebody
 * said elsewhere - it carries who said it, where, and when, and it is somebody
 * else's opinion rather than a fact we are asserting about an employer.
 */
export const FLAG_SOURCE_KINDS = ['posting', 'web'] as const

export type FlagSourceKind = (typeof FLAG_SOURCE_KINDS)[number]

export const FLAG_CATEGORIES = [
  'compensation',
  'culture',
  'expectations',
  'role_clarity',
  'process',
  'stability',
  'growth',
  'interviewing',
  'management',
  'other',
] as const

export type FlagCategory = (typeof FLAG_CATEGORIES)[number]

/**
 * Where a described interview process came from.
 *
 * The distinction is the whole value of the field. A posting that lays out its
 * own stages is reporting; anything else is a sensible guess from the role
 * type, and the reader is entitled to know which one they are looking at.
 */
export const INTERVIEW_PROCESS_BASES = ['stated_in_posting', 'inferred_from_role_type'] as const

export type InterviewProcessBasis = (typeof INTERVIEW_PROCESS_BASES)[number]

export const INTERVIEW_QUESTION_CATEGORIES = [
  'behavioral',
  'technical',
  'system_design',
  'domain',
  'culture',
] as const

export type InterviewQuestionCategory = (typeof INTERVIEW_QUESTION_CATEGORIES)[number]
