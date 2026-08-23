import {
  GAP_TYPES,
  MATCH_ESSENTIAL_CHECKS,
  MATCH_ESSENTIAL_VERDICTS,
  MATCH_RECOMMENDATIONS,
  SKILL_VERDICTS,
} from '@cv-jobs-compatibility/constants'
import { z } from 'zod'
import { toGeminiSchema } from '../gemini-schema'

/**
 * What the model returns when a CV is graded against a posting.
 *
 * Two rules shaped the whole thing.
 *
 * **No overall score is asked for.** The model judges each requirement and each
 * skill; our code turns those into the number a list is sorted by. An overall
 * percentage from a model is the one answer nobody can check, and re-weighting
 * it would mean re-running every match instead of recalculating.
 *
 * **The field order is load-bearing.** Gemini generates in schema order, so the
 * row judgements come first and the prose after - which means the summary is
 * written conditioned on ratings the model has already committed to, rather
 * than alongside them. Without that you get a summary calling someone a strong
 * fit sitting next to a one-star row saying otherwise.
 */

/**
 * Rows are addressed by position, not by id.
 *
 * The requirements are handed over numbered, and the model answers with those
 * numbers. Asking it to echo a uuid back is asking for a character to change in
 * the middle of one, and a judgement we cannot attach to anything.
 */
const matchedRequirement = z.object({
  index: z.number(),
  /** 1 no evidence, 2 tangential, 3 partial, 4 meets it, 5 exceeds it. */
  stars: z.number(),
  /** The role or line of the CV this was read off. Null when there is none. */
  evidence: z.string().nullable(),
})

const matchedSkill = z.object({
  index: z.number(),
  verdict: z.enum(SKILL_VERDICTS),
  /** How far off it is. Null where the verdict is `yes`. */
  gapType: z.enum(GAP_TYPES).nullable(),
  evidence: z.string().nullable(),
})

/**
 * The few checks that apply whatever the posting asks for.
 *
 * `unknown` is not a hedge, it is the common case - a CV rarely states visa
 * status or willingness to relocate. These never enter the score for exactly
 * that reason: a number that moves on an unknown is noise.
 */
const matchedEssential = z.object({
  check: z.enum(MATCH_ESSENTIAL_CHECKS),
  verdict: z.enum(MATCH_ESSENTIAL_VERDICTS),
  /** One sentence, mostly to explain an `unknown`. */
  note: z.string().nullable(),
})

const tailoredQuestion = z.object({
  question: z.string(),
  /** The gap or strength above that makes this one likely to come up. */
  motivatedBy: z.string(),
  howToApproach: z.string(),
})

export const jobMatchResponseSchema = z.object({
  // Judgements first. Everything below is written in their light.
  requirements: z.array(matchedRequirement),
  skills: z.array(matchedSkill),
  essentials: z.array(matchedEssential),

  /**
   * What to do about it. The model's call rather than a threshold on the score,
   * because two roles at the same percentage deserve different advice depending
   * on whether the gaps are learnable - which a number cannot know.
   */
  recommendation: z.enum(MATCH_RECOMMENDATIONS),
  /** Two or three sentences, referring only to the rows above. */
  summary: z.string(),
  /** Three at most, each pointing at something in the CV. */
  strengths: z.array(z.string()),
  /** Three at most, each pointing at a requirement or skill above. */
  gaps: z.array(z.string()),
  tailoredQuestions: z.array(tailoredQuestion),
})

export type JobMatchResponse = z.infer<typeof jobMatchResponseSchema>

/** Ready to hand to Gemini as `responseSchema`. */
export const JOB_MATCH_RESPONSE_SCHEMA = toGeminiSchema(jobMatchResponseSchema)
