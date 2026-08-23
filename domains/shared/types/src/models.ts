/**
 * Domain shapes shared by the API and its clients.
 *
 * These describe data as it travels over the wire, which is why timestamps are
 * ISO-8601 strings rather than `Date`: JSON has no date type, so a client that
 * parses a response holds a string no matter what the server used internally.
 * The API converts at its boundary.
 */

import type {
  EducationLevel,
  EmploymentType,
  FlagCategory,
  FlagPolarity,
  FlagSourceKind,
  GapType,
  InterviewProcessBasis,
  InterviewQuestionCategory,
  JobInsightsStatus,
  JobStatus,
  MatchEssentialCheck,
  MatchEssentialVerdict,
  MatchRecommendation,
  MatchStatus,
  MatchVerdict,
  RequirementImportance,
  RequirementKind,
  ResumeIngestionStatus,
  SalaryPeriod,
  SeniorityLevel,
  SkillCategory,
  SkillVerdict,
  WorkMode,
} from '@cv-jobs-compatibility/constants'

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

/**
 * A job posting as a list renders it, and as the create page polls it.
 *
 * Everything the model reads off the advert is nullable twice over: an advert
 * need not state a salary, and none of it exists at all until the posting has
 * been through the pipeline. A card has to render a row that is still `queued`
 * and knows nothing but when it was added.
 *
 * The pasted text is not here. It is large, it is only ever needed by the
 * worker, and nothing on a screen is better for having it.
 */
export interface JobSummaryModel {
  id: string
  status: JobStatus
  title: string | null
  company: string | null
  locations: string[]
  workMode: WorkMode | null
  employmentType: EmploymentType | null
  seniority: SeniorityLevel | null
  yearsExperienceMin: number | null
  yearsExperienceMax: number | null
  salaryMin: number | null
  salaryMax: number | null
  salaryCurrency: string | null
  salaryPeriod: SalaryPeriod | null
  summary: string | null
  /** Where this account found it, if they said. Never fetched by us. */
  sourceUrl: string | null
  /** When this account added it - not when the posting was first seen. */
  savedAt: string
  /** When the status last changed. What "stalled" is measured against. */
  updatedAt: string
  /**
   * How this posting scored against the account's CV, if it has been scored.
   *
   * Null is the normal state, not an error: scoring is something a person asks
   * for. It also goes back to null after a new CV, because a score is a
   * statement about one CV and one posting, and one of them just changed.
   */
  match: JobMatchSummaryModel | null
}

/** Enough to badge a card and drive the status strip. The report is its own call. */
export interface JobMatchSummaryModel {
  id: string
  status: MatchStatus
  /** 0-100, computed by us from the row judgements. Null until ready. */
  score: number | null
  verdict: MatchVerdict | null
  recommendation: MatchRecommendation | null
  updatedAt: string
}

/**
 * One CV graded against one posting, whole.
 *
 * Everything the model judged, plus the arithmetic over it. The requirement and
 * skill rows carry the posting's own wording alongside the judgement, so the
 * report reads without a second request for the posting.
 */
export interface JobMatchModel extends JobMatchSummaryModel {
  /** Never folded into the score - a number that moves on an unknown is noise. */
  essentials: JobMatchEssentialModel[]
  /** Arithmetic on two stated figures. Null when either side is silent. */
  meetsYearsRequirement: boolean | null
  summary: string | null
  strengths: string[]
  gaps: string[]
  requirements: JobMatchRequirementModel[]
  skills: JobMatchSkillModel[]
  tailoredQuestions: JobMatchQuestionModel[]
}

export interface JobMatchEssentialModel {
  check: MatchEssentialCheck
  verdict: MatchEssentialVerdict
  note: string | null
}

export interface JobMatchRequirementModel {
  id: string
  /** The requirement as the posting put it. */
  text: string
  importance: RequirementImportance
  kind: RequirementKind
  /** 1 no evidence, 5 exceeds it. */
  stars: number
  /** Where in the CV it was found. Null when nothing was. */
  evidence: string | null
}

export interface JobMatchSkillModel {
  id: string
  name: string
  category: SkillCategory
  importance: RequirementImportance
  verdict: SkillVerdict
  /** How far off it is. Null where the verdict is `yes`. */
  gapType: GapType | null
  evidence: string | null
}

export interface JobMatchQuestionModel {
  question: string
  /** The gap or strength that makes this one likely for this candidate. */
  motivatedBy: string
  howToApproach: string
}

/**
 * One posting, whole.
 *
 * `insights` is null while the briefing is still being written, and stays null
 * if it failed - which is not an error state worth surfacing loudly, since a
 * posting without one is still complete enough to apply for. `insightsStatus`
 * is what a page uses to tell "coming" from "not coming".
 */
export interface JobModel extends JobSummaryModel {
  industry: string | null
  teamContext: string | null
  /** What the role does day to day. Not the same as what it demands. */
  responsibilities: string[]
  educationLevel: EducationLevel | null
  educationField: string | null
  educationImportance: RequirementImportance | null
  requirements: JobRequirementModel[]
  skills: JobSkillModel[]
  insightsStatus: JobInsightsStatus
  insights: JobInsightsModel | null
  createdAt: string
}

/**
 * What we found out about the role beyond what it advertises.
 *
 * Everything here is produced by a call that searched the web, and everything
 * carries where it came from. A flag with no attribution never reaches this
 * shape - it is dropped when the briefing is stored.
 */
export interface JobInsightsModel {
  company: JobCompanyModel
  flags: JobFlagModel[]
  /** Whether the stages below were read off the advert or are typical. */
  interviewBasis: InterviewProcessBasis
  interviewStages: JobInterviewStageModel[]
  interviewQuestions: JobInterviewQuestionModel[]
}

export interface JobCompanyModel {
  /**
   * False is a real answer and a common one. A small employer nobody has
   * written about is a small employer nobody has written about, and saying so
   * beats inventing a history for them.
   */
  known: boolean
  whatTheyDo: string | null
  sector: string | null
  sizeEstimate: string | null
}

export interface JobFlagModel {
  id: string
  polarity: FlagPolarity
  category: FlagCategory
  text: string
  /** The line of the advert, or what the person actually wrote. */
  evidence: string | null
  /** Read off the advert, or somebody's opinion from elsewhere. */
  sourceKind: FlagSourceKind
  /** Who said it. Null for a posting flag. */
  sourceLabel: string | null
  sourceUrl: string | null
  /** As reported, e.g. "March 2024". Never a date we computed. */
  sourceDate: string | null
}

export interface JobInterviewStageModel {
  stage: string
  whatTheyAssess: string
  typicalDuration: string | null
}

export interface JobInterviewQuestionModel {
  question: string
  whatTheyAreProbing: string
  category: InterviewQuestionCategory
}

export interface JobRequirementModel {
  id: string
  /** The short canonical phrase, which is what gets graded. */
  text: string
  /** The bullet as the advert wrote it. Null when nothing was trimmed. */
  originalText: string | null
  importance: RequirementImportance
  kind: RequirementKind
}

export interface JobSkillModel {
  id: string
  name: string
  category: SkillCategory
  importance: RequirementImportance
}
