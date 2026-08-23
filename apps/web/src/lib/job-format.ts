import type {
  EducationLevel,
  EmploymentType,
  GapType,
  MatchEssentialCheck,
  MatchRecommendation,
  MatchVerdict,
  RequirementKind,
  SalaryPeriod,
  SeniorityLevel,
  SkillVerdict,
  WorkMode,
} from '@cv-jobs-compatibility/constants'
import type { JobSummaryModel } from '@cv-jobs-compatibility/types'

/**
 * Turning stored enum members into words.
 *
 * The database holds `full_time` because a column wants a stable identifier;
 * a person wants "Full-time". Keeping the two apart means renaming a label is
 * not a migration.
 */

export const WORK_MODE_LABELS: Record<WorkMode, string> = {
  onsite: 'On-site',
  hybrid: 'Hybrid',
  remote: 'Remote',
}

export const EMPLOYMENT_TYPE_LABELS: Record<EmploymentType, string> = {
  full_time: 'Full-time',
  part_time: 'Part-time',
  contract: 'Contract',
  internship: 'Internship',
  temporary: 'Temporary',
}

export const SENIORITY_LABELS: Record<SeniorityLevel, string> = {
  intern: 'Intern',
  junior: 'Junior',
  mid: 'Mid-level',
  senior: 'Senior',
  staff: 'Staff',
  principal: 'Principal',
  lead: 'Lead',
  manager: 'Manager',
  director: 'Director',
}

export const EDUCATION_LEVEL_LABELS: Record<EducationLevel, string> = {
  high_school: 'High school',
  associate: 'Associate degree',
  bachelor: "Bachelor's degree",
  master: "Master's degree",
  doctorate: 'Doctorate',
}

export const REQUIREMENT_KIND_LABELS: Record<RequirementKind, string> = {
  skill: 'Skill',
  experience: 'Experience',
  education: 'Education',
  certification: 'Certification',
  language: 'Language',
  eligibility: 'Eligibility',
  other: 'Other',
}

const PERIOD_SUFFIX: Record<SalaryPeriod, string> = {
  hour: '/hr',
  day: '/day',
  month: '/mo',
  year: '/yr',
}

/**
 * A pay range as an advert would write it.
 *
 * The currency comes off a document a stranger wrote, so `Intl` is given a
 * chance to reject it rather than trusted to be a real ISO code.
 */
export function formatSalary(job: JobSummaryModel): string | null {
  const { salaryMin, salaryMax, salaryCurrency, salaryPeriod } = job
  if (salaryMin === null && salaryMax === null) return null

  const format = (value: number) => {
    try {
      return new Intl.NumberFormat(undefined, {
        style: salaryCurrency ? 'currency' : 'decimal',
        currency: salaryCurrency ?? undefined,
        maximumFractionDigits: 0,
      }).format(value)
    } catch {
      return value.toLocaleString()
    }
  }

  const range =
    salaryMin !== null && salaryMax !== null && salaryMin !== salaryMax
      ? `${format(salaryMin)} – ${format(salaryMax)}`
      : format((salaryMin ?? salaryMax) as number)

  return salaryPeriod ? `${range}${PERIOD_SUFFIX[salaryPeriod]}` : range
}

/** "5+ years", "3 – 5 years", or nothing when the advert did not say. */
export function formatYearsRequired(job: JobSummaryModel): string | null {
  const { yearsExperienceMin: min, yearsExperienceMax: max } = job

  if (min !== null && max !== null && min !== max) return `${min} – ${max} years`
  if (min !== null) return `${min}+ years`
  if (max !== null) return `up to ${max} years`

  return null
}

export const VERDICT_LABELS: Record<MatchVerdict, string> = {
  strong_fit: 'Strong fit',
  stretch: 'A stretch',
  reach: 'A reach',
  mismatch: 'Not a fit',
}

/**
 * The recommendation is the one thing on the report that tells you what to do,
 * so it is worded as an instruction rather than an assessment.
 */
export const RECOMMENDATION_LABELS: Record<MatchRecommendation, string> = {
  apply_now: 'Apply',
  tailor_first: 'Tailor your CV first',
  close_gaps_first: 'Close the gaps first',
  skip: 'Give this one a miss',
}

export const SKILL_VERDICT_LABELS: Record<SkillVerdict, string> = {
  yes: 'Have it',
  partial: 'Close',
  no: 'Missing',
}

export const GAP_TYPE_LABELS: Record<GapType, string> = {
  quick_to_learn: 'quick to pick up',
  needs_a_project: 'needs a project',
  needs_years: 'needs years',
}

export const ESSENTIAL_LABELS: Record<MatchEssentialCheck, string> = {
  work_authorisation: 'Right to work',
  location: 'Location',
  work_mode: 'On-site expectations',
  employment_type: 'Type of contract',
}

/** What a card calls a posting before anything has been read out of it. */
export function jobTitle(job: JobSummaryModel): string {
  return job.title ?? 'Untitled posting'
}
