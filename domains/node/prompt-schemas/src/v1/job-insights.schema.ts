import {
  FLAG_CATEGORIES,
  FLAG_POLARITIES,
  FLAG_SOURCE_KINDS,
  INTERVIEW_PROCESS_BASES,
  INTERVIEW_QUESTION_CATEGORIES,
} from '@cv-jobs-compatibility/constants'
import { z } from 'zod'
import { toGeminiSchema } from '../gemini-schema'

/**
 * What the model is asked for beyond what the advert says.
 *
 * A separate contract from extraction because the two ask for opposite things.
 * Extraction copies and never infers; this reasons past the document and
 * searches the web. Versioned separately for the same reason - changing a guess
 * should not mean re-reading every posting.
 *
 * The shape is built around one rule: nothing here may be an unattributed
 * claim about a real employer. Every flag says where it came from, and the
 * ones that came from the web carry who said it and when, so a reader can go
 * and look rather than take our word for it.
 */

const flagSource = z.object({
  kind: z.enum(FLAG_SOURCE_KINDS),
  /** Who said it: "Glassdoor review", "former engineer on Reddit". */
  label: z.string().nullable(),
  /** Where it can be read. Null only when there is genuinely no link. */
  url: z.string().nullable(),
  /** As reported: "March 2024", "two years ago". Never a guess. */
  date: z.string().nullable(),
})

const jobFlag = z.object({
  polarity: z.enum(FLAG_POLARITIES),
  category: z.enum(FLAG_CATEGORIES),
  /** One sentence, factual, in your own words. */
  text: z.string(),
  /** The words this was read out of - a line of the advert, or the review. */
  evidence: z.string().nullable(),
  source: flagSource,
})

const interviewStage = z.object({
  /** The stage as a candidate would name it: "HR screen", "Take-home". */
  stage: z.string(),
  whatTheyAssess: z.string(),
  /** Free text, e.g. "45 minutes", "3-4 hours over a weekend". */
  typicalDuration: z.string().nullable(),
})

const interviewQuestion = z.object({
  question: z.string(),
  /** What the interviewer is really testing, which is the useful half. */
  whatTheyAreProbing: z.string(),
  category: z.enum(INTERVIEW_QUESTION_CATEGORIES),
})

/**
 * What is known about the employer.
 *
 * `known` is the escape hatch and it is load-bearing. Most companies in most
 * adverts are small enough that a model with no result has nothing to say, and
 * without an honest way to say so it will produce a founding year, a funding
 * round and a culture. False here is a good answer.
 */
const companyFacts = z.object({
  known: z.boolean(),
  whatTheyDo: z.string().nullable(),
  sector: z.string().nullable(),
  /** Rough, as found: "about 200 people", "Series B". */
  sizeEstimate: z.string().nullable(),
})

export const jobInsightsResponseSchema = z.object({
  company: companyFacts,
  flags: z.array(jobFlag),
  /** Read off the advert where it describes its own process, guessed otherwise. */
  interviewBasis: z.enum(INTERVIEW_PROCESS_BASES),
  /** In order, first contact to offer. */
  interviewStages: z.array(interviewStage),
  interviewQuestions: z.array(interviewQuestion),
})

export type JobInsightsResponse = z.infer<typeof jobInsightsResponseSchema>

/** Ready to hand to Gemini as `responseSchema`. */
export const JOB_INSIGHTS_RESPONSE_SCHEMA = toGeminiSchema(jobInsightsResponseSchema)
