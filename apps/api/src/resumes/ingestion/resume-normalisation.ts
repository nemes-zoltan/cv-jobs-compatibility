import type { SkillCategory } from '@cv-jobs-compatibility/constants'

/**
 * Turning what a CV says into what the tables hold.
 *
 * Pure functions on purpose: this is the part most likely to be wrong on a real
 * document, and it should be testable without a database or a model.
 */

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
}

/**
 * A date as a CV writes it, as a date the database can hold.
 *
 * Deliberately narrow. Everything it does not recognise becomes null, and the
 * original string is stored alongside regardless - a wrong date is worse than a
 * missing one when the raw text is right there to read.
 *
 * A partial date becomes the first of its period, because `date` has no way to
 * say "sometime in 2019".
 */
export function parseResumeDate(raw: string | null): string | null {
  if (!raw) return null

  const text = raw.trim().toLowerCase()
  if (!text || text === 'present' || text === 'current' || text === 'now') return null

  // 2019-03-15
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text)
  if (iso) return toDate(+iso[1], +iso[2], +iso[3])

  // 2019-03, 2019/03
  const yearMonth = /^(\d{4})[-/](\d{1,2})$/.exec(text)
  if (yearMonth) return toDate(+yearMonth[1], +yearMonth[2], 1)

  // 03/2019, 3-2019
  const monthYear = /^(\d{1,2})[-/](\d{4})$/.exec(text)
  if (monthYear) return toDate(+monthYear[2], +monthYear[1], 1)

  // Jan 2019, January 2019, Jan. 2019, Jan '19 is deliberately not handled -
  // a two-digit year is ambiguous and rare enough to leave as raw text.
  const named = /^([a-z]{3,9})\.?\s+(\d{4})$/.exec(text)
  if (named) {
    const month = MONTHS[named[1].slice(0, 3)]
    if (month) return toDate(+named[2], month, 1)
  }

  // 2019
  const year = /^(\d{4})$/.exec(text)
  if (year) return toDate(+year[1], 1, 1)

  return null
}

function toDate(year: number, month: number, day: number): string | null {
  // A CV predating 1900 or postdating next century is a parse gone wrong.
  if (year < 1900 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) return null

  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

/**
 * The comparable form of a skill name.
 *
 * Only case, spacing and trailing punctuation are removed. "React" and "React"
 * written differently should meet here; "React" and "React Native" must not -
 * anything cleverer belongs to the semantic matching, not to a string function.
 */
export function normalizeSkillName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[.,;:!?]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

export interface ExtractedSkill {
  name: string
  category: SkillCategory
}

/**
 * One row per skill per resume.
 *
 * The prompt asks the model not to repeat itself and it usually obliges, but a
 * CV listing React under both "Frontend" and "Frameworks" is exactly the case
 * where it will. The unique index would abort the whole transaction, taking the
 * resume with it, so duplicates are dropped here - first mention wins, since
 * that is the one the document led with.
 */
export function dedupeSkills(skills: ExtractedSkill[]): (ExtractedSkill & { normalizedName: string })[] {
  const seen = new Map<string, ExtractedSkill & { normalizedName: string }>()

  for (const skill of skills) {
    const normalizedName = normalizeSkillName(skill.name)
    if (!normalizedName || seen.has(normalizedName)) continue

    seen.set(normalizedName, { ...skill, normalizedName })
  }

  return [...seen.values()]
}

/**
 * `numeric(4, 1)` holds one decimal place and refuses anything over 999.9, so a
 * model that answers `12.3456` or hallucinates a century has to be clamped
 * before it reaches the column rather than after it raises.
 */
export function toYearsOfExperience(value: number | null): string | null {
  if (value === null || !Number.isFinite(value) || value < 0) return null

  return Math.min(value, 999.9).toFixed(1)
}
