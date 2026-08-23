import type { ExtractedJob } from '@cv-jobs-compatibility/prompt-schemas'

/**
 * Turning what an advert says into what the columns hold.
 *
 * Pure functions on purpose: this is where a model's answer meets a `numeric`
 * column that will raise rather than round, and it should be testable without a
 * database.
 */

/** Beyond this the list stops being a rubric and starts being the advert again. */
const MAX_REQUIREMENTS = 25

/**
 * A number as the model answered it, as a `numeric` column can hold it.
 *
 * The bounds are the column's, not the world's: `numeric(4, 1)` refuses
 * anything over 999.9 and `numeric(12, 2)` over ten digits, so a model that
 * hallucinates a century of experience or a salary in centavos has to be
 * clamped before the insert rather than after it raises.
 */
function toDecimal(value: number | null, max: number, scale: number): string | null {
  if (value === null || !Number.isFinite(value) || value < 0) return null

  return Math.min(value, max).toFixed(scale)
}

/** Years of experience, for `numeric(4, 1)`. */
export function toYearsRequired(value: number | null): string | null {
  return toDecimal(value, 999.9, 1)
}

/** A pay figure, for `numeric(12, 2)`. */
export function toSalaryAmount(value: number | null): string | null {
  return toDecimal(value, 9_999_999_999.99, 2)
}

/**
 * A currency code, or nothing.
 *
 * The model is asked for ISO 4217 and mostly obliges, but an advert writing
 * "£" or "dollars" is enough to get a "£" back. Anything that is not three
 * letters is dropped rather than stored, because a bad code makes `Intl` throw
 * on a page rather than fail here where nobody is watching.
 */
export function toCurrencyCode(value: string | null): string | null {
  if (!value) return null

  const code = value.trim().toUpperCase()

  return /^[A-Z]{3}$/.test(code) ? code : null
}

/**
 * The requirement rows, bounded.
 *
 * The prompt asks for at most twenty-five and a padded advert will still
 * produce forty, so the ceiling is enforced here as well. It is not tidiness:
 * every requirement becomes a graded row for every CV this posting is ever
 * scored against, so the extraction is what sets the recurring cost of scoring.
 *
 * Essential ones survive a trim first, since those are what a decision turns on.
 */
export function toRequirements(requirements: ExtractedJob['requirements']): ExtractedJob['requirements'] {
  const usable = requirements.filter((one) => one.text.trim().length > 0)
  if (usable.length <= MAX_REQUIREMENTS) return usable

  const required = usable.filter((one) => one.importance === 'required')
  const preferred = usable.filter((one) => one.importance === 'preferred')

  return [...required, ...preferred].slice(0, MAX_REQUIREMENTS)
}

/**
 * Whether there is anything here to grade a CV against.
 *
 * A posting the model accepted but read nothing out of is a shell: it would sit
 * in the list looking parsed and score every CV identically, which is worse
 * than saying plainly that we could not use it.
 */
export function hasSomethingToGrade(job: ExtractedJob): boolean {
  return job.requirements.length > 0 || job.skills.length > 0
}
