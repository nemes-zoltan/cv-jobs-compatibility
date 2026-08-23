import {
  EDUCATION_LEVELS,
  EMPLOYMENT_TYPES,
  REQUIREMENT_IMPORTANCE_LEVELS,
  REQUIREMENT_KINDS,
  SALARY_PERIODS,
  SENIORITY_LEVELS,
  SKILL_CATEGORIES,
  WORK_MODES,
} from '@cv-jobs-compatibility/constants'
import { z } from 'zod'
import { toGeminiSchema } from '../gemini-schema'

/**
 * What the model is asked to return for a job advert.
 *
 * Shaped by what has to be answered later rather than by what an advert
 * contains. Three questions drive it: what am I missing, how does my experience
 * line up, and which of these should I go for. So requirements come back as
 * individually gradeable lines, skills come back as a flat comparable list, and
 * the things a ranking sorts on - seniority, years, pay, work mode - are enums
 * and numbers rather than sentences.
 *
 * Every field an advert might omit is nullable and every list can be empty, so
 * "not stated" has an honest representation. Without one, a required field is
 * an invitation to invent a plausible value.
 */

const jobRequirement = z.object({
  /** The short canonical phrase, which is what gets graded against a CV. */
  text: z.string(),
  /** The bullet as the advert wrote it. Null when nothing needed trimming. */
  originalText: z.string().nullable(),
  importance: z.enum(REQUIREMENT_IMPORTANCE_LEVELS),
  kind: z.enum(REQUIREMENT_KINDS),
})

/**
 * No years here, deliberately. A CV does not record how long anyone used a
 * tool, so "3+ years of React" cannot be checked as a property of a skill - it
 * is a requirement, and it is graded like one.
 */
const jobSkill = z.object({
  name: z.string(),
  category: z.enum(SKILL_CATEGORIES),
  importance: z.enum(REQUIREMENT_IMPORTANCE_LEVELS),
})

const jobEducation = z.object({
  level: z.enum(EDUCATION_LEVELS),
  /** e.g. "Computer Science". Null when the advert names no field. */
  field: z.string().nullable(),
  importance: z.enum(REQUIREMENT_IMPORTANCE_LEVELS),
})

const jobSalary = z.object({
  min: z.number().nullable(),
  max: z.number().nullable(),
  /** ISO 4217, e.g. "GBP". Null when the advert shows no currency. */
  currency: z.string().nullable(),
  period: z.enum(SALARY_PERIODS).nullable(),
})

export const extractedJobSchema = z.object({
  title: z.string().nullable(),
  company: z.string().nullable(),
  /** Adverts routinely list several. Empty when it names none. */
  locations: z.array(z.string()),
  workMode: z.enum(WORK_MODES).nullable(),
  employmentType: z.enum(EMPLOYMENT_TYPES).nullable(),
  /**
   * One of the three judgements the model is allowed to make, because adverts
   * state a title rather than a rung and the two disagree constantly.
   */
  seniority: z.enum(SENIORITY_LEVELS).nullable(),
  yearsExperienceMin: z.number().nullable(),
  yearsExperienceMax: z.number().nullable(),
  salary: jobSalary.nullable(),
  /** e.g. "fintech". Same stack in a different domain is a real misalignment. */
  industry: z.string().nullable(),
  /** What the team builds, its size, its stack - interview material. */
  teamContext: z.string().nullable(),
  /** Two or three sentences in the model's own words. */
  summary: z.string().nullable(),
  education: jobEducation.nullable(),
  /** What the role does, as written. Not the same as what it demands. */
  responsibilities: z.array(z.string()),
  requirements: z.array(jobRequirement),
  skills: z.array(jobSkill),
  /** Stored as `extras` until something queries them structurally. */
  benefits: z.array(z.string()),
})

/**
 * The whole response.
 *
 * `valid` is the guardrail: the model decides whether the text is a job advert
 * at all, and a `false` leaves `job` null rather than inventing a role from a
 * press release. Both halves come back in one call, so text that is not a
 * posting costs one request rather than two.
 */
export const jobExtractionResponseSchema = z.object({
  valid: z.boolean(),
  /** One short sentence on what the text is instead. Null when valid. */
  rejectionReason: z.string().nullable(),
  job: extractedJobSchema.nullable(),
})

export type ExtractedJob = z.infer<typeof extractedJobSchema>
export type JobExtractionResponse = z.infer<typeof jobExtractionResponseSchema>

/** Ready to hand to Gemini as `responseSchema`. */
export const JOB_EXTRACTION_RESPONSE_SCHEMA = toGeminiSchema(jobExtractionResponseSchema)
