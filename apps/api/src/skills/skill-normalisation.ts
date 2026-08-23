import type { SkillCategory } from '@cv-jobs-compatibility/constants'

/**
 * The comparison vocabulary both sides of a match speak.
 *
 * Lives here rather than beside either pipeline because that is the whole
 * point: a skill read off a CV and a skill read off a job advert have to be
 * lowercased and stripped by the *same* function, or the cheap half of matching
 * silently stops working on words nobody controls.
 *
 * Pure, so the part most likely to be subtly wrong is testable without a
 * database or a model.
 */

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
 * One row per skill per document.
 *
 * The prompts ask the model not to repeat itself and it usually obliges, but a
 * CV listing React under both "Frontend" and "Frameworks" - or an advert naming
 * Kubernetes in the requirements and again in the stack - is exactly where it
 * will. The unique index would abort the whole transaction, taking the document
 * with it, so duplicates are dropped here: first mention wins, since that is
 * the one the document led with.
 */
export function dedupeSkills<T extends ExtractedSkill>(skills: T[]): (T & { normalizedName: string })[] {
  const seen = new Map<string, T & { normalizedName: string }>()

  for (const skill of skills) {
    const normalizedName = normalizeSkillName(skill.name)
    if (!normalizedName || seen.has(normalizedName)) continue

    seen.set(normalizedName, { ...skill, normalizedName })
  }

  return [...seen.values()]
}
