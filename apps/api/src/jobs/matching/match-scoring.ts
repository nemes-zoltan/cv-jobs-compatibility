import type { MatchVerdict, RequirementImportance, SkillVerdict } from '@cv-jobs-compatibility/constants'

/**
 * Turning per-row judgements into the one number a list is sorted by.
 *
 * Ours, not the model's, and that is the whole point of the design: the
 * weights below can change and every stored match re-ranks without a single
 * call being made again. Asking a model for a better percentage would mean
 * paying for every match twice.
 *
 * Pure, so the thing that decides what a 73 means is testable without a
 * database or a model.
 */

/**
 * A required line counts for three preferred ones.
 *
 * Not measured - chosen. It says that clearing the bar matters more than
 * collecting bonuses, which is the judgement a candidate is actually making.
 */
const REQUIREMENT_WEIGHTS: Record<RequirementImportance, number> = {
  required: 3,
  preferred: 1,
}

/**
 * Skills weigh less than requirements at the same importance, because a
 * requirement is a sentence somebody wrote deliberately and a skill is a word
 * that appeared in a list.
 */
const SKILL_WEIGHTS: Record<RequirementImportance, number> = {
  required: 2,
  preferred: 1,
}

const SKILL_VALUES: Record<SkillVerdict, number> = {
  yes: 1,
  partial: 0.5,
  no: 0,
}

/**
 * Where the labels sit on the scale.
 *
 * Derived here rather than asked of the model, so the badge can never
 * contradict the number printed beside it.
 */
const VERDICT_THRESHOLDS: { min: number; verdict: MatchVerdict }[] = [
  { min: 80, verdict: 'strong_fit' },
  { min: 60, verdict: 'stretch' },
  { min: 40, verdict: 'reach' },
  { min: 0, verdict: 'mismatch' },
]

export interface ScoredRequirement {
  importance: RequirementImportance
  /** 1 to 5, as graded. */
  stars: number
}

export interface ScoredSkill {
  importance: RequirementImportance
  verdict: SkillVerdict
}

/**
 * A weighted percentage of the points on offer.
 *
 * Essentials are deliberately absent. Work authorisation and the like are
 * usually `unknown` - a CV rarely states visa status - and a score that moves
 * on an unknown is noise. They belong at the top of the report as flags, where
 * a person can read them, not folded into a number where they cannot.
 *
 * Years of experience is absent for a different reason: "5+ years of Python"
 * arrives as a requirement row and is graded like any other, so scoring it
 * again would count one demand twice.
 */
export function scoreMatch(requirements: ScoredRequirement[], skills: ScoredSkill[]): number | null {
  let earned = 0
  let available = 0

  for (const requirement of requirements) {
    const weight = REQUIREMENT_WEIGHTS[requirement.importance]
    // 1 star is no evidence and must be worth nothing, 5 is full marks - so the
    // 1-5 scale is shifted onto 0-1 rather than divided by five, which would
    // hand out 20% for having nothing.
    const value = (clampStars(requirement.stars) - 1) / 4

    earned += weight * value
    available += weight
  }

  for (const skill of skills) {
    const weight = SKILL_WEIGHTS[skill.importance]

    earned += weight * SKILL_VALUES[skill.verdict]
    available += weight
  }

  // A posting with no requirements and no skills never reaches here - it is
  // rejected at extraction - but a score of zero would be a lie about a
  // candidate rather than an absence, so it stays null.
  if (available === 0) return null

  return Math.round((earned / available) * 100)
}

export function verdictFor(score: number): MatchVerdict {
  return VERDICT_THRESHOLDS.find(({ min }) => score >= min)?.verdict ?? 'mismatch'
}

/**
 * Whether the CV clears the posting's stated minimum.
 *
 * Arithmetic on two numbers we already hold, which is why no model is asked for
 * it. Null when either side is silent - most CVs do not state a total and
 * plenty of adverts name no minimum, and "we cannot tell" is a different answer
 * from "no".
 */
export function meetsYearsRequirement(
  resumeYears: number | null,
  jobYearsMin: number | null,
): boolean | null {
  if (resumeYears === null || jobYearsMin === null) return null

  return resumeYears >= jobYearsMin
}

function clampStars(stars: number): number {
  if (!Number.isFinite(stars)) return 1

  return Math.min(5, Math.max(1, Math.round(stars)))
}
