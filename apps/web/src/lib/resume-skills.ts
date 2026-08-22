import type { SkillCategory } from '@cv-jobs-compatibility/constants'
import type { ResumeExperienceModel, ResumeSkillModel } from '@cv-jobs-compatibility/types'

/** Reading order, which is not the order the enum happens to declare. */
const CATEGORY_ORDER: SkillCategory[] = [
  'language',
  'framework',
  'database',
  'platform',
  'tool',
  'domain',
  'soft',
  'other',
]

export const CATEGORY_LABELS: Record<SkillCategory, string> = {
  language: 'Languages',
  framework: 'Frameworks',
  database: 'Databases',
  platform: 'Platforms',
  tool: 'Tools',
  domain: 'Domain',
  soft: 'Soft skills',
  other: 'Other',
}

export interface SkillGroup {
  category: SkillCategory
  label: string
  skills: ResumeSkillModel[]
}

/** Fifty-odd skills in one list is a wall. Grouped, it is a summary. */
export function groupSkills(skills: ResumeSkillModel[]): SkillGroup[] {
  return CATEGORY_ORDER.map((category) => ({
    category,
    label: CATEGORY_LABELS[category],
    skills: skills.filter((skill) => skill.category === category),
  })).filter((group) => group.skills.length > 0)
}

/**
 * Two characters is where a match stops meaning anything: "R" and "C" would hit
 * almost any sentence, and the noise costs more than the coverage is worth.
 */
const MIN_MATCHABLE_LENGTH = 2

/**
 * Which skills this role's own text mentions.
 *
 * An approximation, and worth being honest about: nothing links a skill to a
 * job. The extraction schema asks for one flat list per CV, so this reads the
 * role's summary and bullets and looks for skill names in them. A skill used
 * but not written down does not appear.
 *
 * The proper fix is asking the model which skills belong to which role, and
 * that means a new prompt version - see DECISIONS.md.
 */
export function skillsMentionedIn(
  experience: ResumeExperienceModel,
  skills: ResumeSkillModel[],
): ResumeSkillModel[] {
  const text = [experience.summary ?? '', ...experience.highlights].join('\n').toLowerCase()
  if (!text.trim()) return []

  return skills.filter((skill) => {
    const name = skill.name.toLowerCase()
    if (name.length < MIN_MATCHABLE_LENGTH) return false

    return mentions(text, name)
  })
}

/**
 * Whole-word matching, so "Java" does not light up on "JavaScript".
 *
 * A plain `\b` will not do it: the boundary is defined against word characters,
 * and a name ending in punctuation - "C++", "F#", "Node.js" - has none where it
 * needs one. So the edges are checked by hand against what may sit beside them.
 */
function mentions(text: string, name: string): boolean {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const pattern = new RegExp(`(^|[^a-z0-9+#.])${escaped}($|[^a-z0-9+#])`, 'i')

  return pattern.test(text)
}
