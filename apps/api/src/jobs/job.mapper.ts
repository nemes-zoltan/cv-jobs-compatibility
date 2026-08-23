import type { JobInsightsModel, JobModel, JobSummaryModel } from '@cv-jobs-compatibility/types'
import type {
  JobFlagRow,
  JobInsightsRow,
  JobMatchRow,
  JobRequirementRow,
  JobRow,
  JobSkillRow,
} from '../database/schema'
import { toJobMatchSummaryModel } from './match.mapper'

/**
 * A posting joined to one account's interest in it.
 *
 * The two halves come from different tables on purpose: `savedAt` and
 * `sourceUrl` describe this person's copy, everything else describes the advert
 * and is the same for everyone who saved it.
 */
export interface SavedJobRows {
  job: JobRow
  savedAt: Date
  sourceUrl: string | null
  /**
   * The score against the account's current CV, when there is one. Absent
   * rather than stale after a new CV: matches are keyed to the resume, so a new
   * one simply has none yet.
   */
  match: JobMatchRow | null
}

export interface JobWithSections extends SavedJobRows {
  requirements: JobRequirementRow[]
  skills: JobSkillRow[]
  /** Null until the briefing has been written, and if it never is. */
  insights: JobInsightsRow | undefined
  flags: JobFlagRow[]
}

/**
 * `numeric` columns come back as strings and the contract says number, so every
 * one of them converts here rather than in four different callers.
 */
function toNumber(value: string | null): number | null {
  return value === null ? null : Number(value)
}

/**
 * What a card renders.
 *
 * The content hash, the pasted text and the pg-boss job id are all absent by
 * construction: the shape is built field by field rather than by spreading the
 * row, so a column added to the table never leaks into a response by accident.
 */
export function toJobSummaryModel({ job, savedAt, sourceUrl, match }: SavedJobRows): JobSummaryModel {
  return {
    id: job.id,
    status: job.status,
    title: job.title,
    company: job.company,
    locations: job.locations ?? [],
    workMode: job.workMode,
    employmentType: job.employmentType,
    seniority: job.seniority,
    yearsExperienceMin: toNumber(job.yearsExperienceMin),
    yearsExperienceMax: toNumber(job.yearsExperienceMax),
    salaryMin: toNumber(job.salaryMin),
    salaryMax: toNumber(job.salaryMax),
    salaryCurrency: job.salaryCurrency,
    salaryPeriod: job.salaryPeriod,
    summary: job.summary,
    sourceUrl,
    savedAt: savedAt.toISOString(),
    updatedAt: job.updatedAt.toISOString(),
    match: match ? toJobMatchSummaryModel(match) : null,
  }
}

/**
 * The briefing, or nothing.
 *
 * Nothing is the answer whenever the row is absent or was written without an
 * interview process - a half-briefing rendered as a set of empty headings is
 * worse than the page simply not having that section.
 */
function toJobInsightsModel(
  insights: JobInsightsRow | undefined,
  flags: JobFlagRow[],
): JobInsightsModel | null {
  if (!insights) return null

  return {
    company: insights.companyFacts ?? {
      known: false,
      whatTheyDo: null,
      sector: null,
      sizeEstimate: null,
    },
    flags: flags.map((row) => ({
      id: row.id,
      polarity: row.polarity,
      category: row.category,
      text: row.text,
      evidence: row.evidence,
      sourceKind: row.sourceKind,
      sourceLabel: row.sourceLabel,
      sourceUrl: row.sourceUrl,
      sourceDate: row.sourceDate,
    })),
    interviewBasis: insights.interviewBasis ?? 'inferred_from_role_type',
    interviewStages: insights.interviewStages ?? [],
    interviewQuestions: insights.interviewQuestions ?? [],
  }
}

export function toJobModel({
  requirements,
  skills,
  insights,
  flags,
  ...saved
}: JobWithSections): JobModel {
  return {
    ...toJobSummaryModel(saved),
    industry: saved.job.industry,
    teamContext: saved.job.teamContext,
    responsibilities: saved.job.responsibilities ?? [],
    educationLevel: saved.job.educationLevel,
    educationField: saved.job.educationField,
    educationImportance: saved.job.educationImportance,

    requirements: requirements.map((row) => ({
      id: row.id,
      text: row.text,
      originalText: row.originalText,
      importance: row.importance,
      kind: row.kind,
    })),

    // `normalizedName` is a comparison key, not something to read.
    skills: skills.map((row) => ({
      id: row.id,
      name: row.name,
      category: row.category,
      importance: row.importance,
    })),

    insightsStatus: saved.job.insightsStatus,
    insights: toJobInsightsModel(insights, flags),

    createdAt: saved.job.createdAt.toISOString(),
  }
}
