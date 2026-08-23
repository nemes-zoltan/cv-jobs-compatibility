/**
 * The vocabulary of a match between one CV and one posting.
 *
 * The division that runs through all of it: the model returns a judgement per
 * row - stars on a requirement, a verdict on a skill - and our code turns those
 * into the single number a list is sorted by. Nothing here asks a model for an
 * overall score, because an overall score is the one answer nobody can check.
 *
 * Keeping the judgements as rows is also what makes the weighting free to
 * change: re-ranking is a recalculation, not a re-run.
 */

export const MATCH_STATUSES = ['queued', 'analyzing', 'ready', 'failed'] as const

export type MatchStatus = (typeof MATCH_STATUSES)[number]

export const TERMINAL_MATCH_STATUSES = ['ready', 'failed'] as const

export type TerminalMatchStatus = (typeof TERMINAL_MATCH_STATUSES)[number]

/**
 * The headline label, for a badge and a filter.
 *
 * An enum rather than a sentence because this one has to mean the same thing on
 * every job in the list - which is exactly what prose cannot promise.
 */
export const MATCH_VERDICTS = ['strong_fit', 'stretch', 'reach', 'mismatch'] as const

export type MatchVerdict = (typeof MATCH_VERDICTS)[number]

/**
 * What to actually do about it.
 *
 * An action rather than an observation, which is the difference between a
 * report and an assistant.
 */
export const MATCH_RECOMMENDATIONS = ['apply_now', 'tailor_first', 'close_gaps_first', 'skip'] as const

export type MatchRecommendation = (typeof MATCH_RECOMMENDATIONS)[number]

/**
 * Whether the CV shows a skill the posting asks for.
 *
 * Three states, not a boolean. A CV full of Vue against a posting wanting React
 * is not the same answer as a CV with no frontend at all, and collapsing the
 * two produces gap lists that read as nonsense to the person who wrote the CV.
 *
 * There is no `unknown`: the CV is the whole evidence, so silence is `no`.
 */
export const SKILL_VERDICTS = ['yes', 'partial', 'no'] as const

export type SkillVerdict = (typeof SKILL_VERDICTS)[number]

/** How far off a missing skill is. What turns a gap list into a plan. */
export const GAP_TYPES = ['quick_to_learn', 'needs_a_project', 'needs_years'] as const

export type GapType = (typeof GAP_TYPES)[number]

/**
 * The few checks that apply to every posting, whatever it asks for.
 *
 * Fixed and small, so these are stored as one blob on the match rather than as
 * rows - unlike requirements and skills, which vary per posting and get
 * aggregated across them. Years of experience is absent on purpose: both sides
 * of that comparison are numbers in columns, so it is arithmetic our code does
 * rather than a judgement anyone should be paying a model for.
 */
export const MATCH_ESSENTIAL_CHECKS = [
  'work_authorisation',
  'location',
  'work_mode',
  'employment_type',
] as const

export type MatchEssentialCheck = (typeof MATCH_ESSENTIAL_CHECKS)[number]

/**
 * `unknown` is not a hedge, it is the common case: a CV rarely states visa
 * status or willingness to relocate. Without it the model has to choose between
 * two wrong answers, and it will choose `yes`.
 */
export const MATCH_ESSENTIAL_VERDICTS = ['yes', 'unknown', 'no'] as const

export type MatchEssentialVerdict = (typeof MATCH_ESSENTIAL_VERDICTS)[number]
