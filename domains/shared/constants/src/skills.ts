/**
 * How an extracted skill is filed.
 *
 * Both the drizzle `skill_category` enum and the extraction schema sent to the
 * model read this list, so a category the model may return is always one the
 * column accepts.
 *
 * Adding one changes what a released prompt version asks for, which is why
 * `prompt-schemas` pins its emitted JSON Schema with a snapshot test - the
 * change has to be deliberate and versioned.
 */
export const SKILL_CATEGORIES = [
  'language',
  'framework',
  'tool',
  'platform',
  'database',
  'soft',
  'domain',
  'other',
] as const

export type SkillCategory = (typeof SKILL_CATEGORIES)[number]
