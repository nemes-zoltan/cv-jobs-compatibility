import { SKILL_CATEGORIES } from '@cv-jobs-compatibility/constants'
import { z } from 'zod'
import { toGeminiSchema } from '../gemini-schema'

/**
 * What the model is asked to return for a resume.
 *
 * Two rules shaped this, and both are about not asking for trouble:
 *
 * Nothing derivable in code is asked for. Dates come back exactly as the
 * document wrote them and are normalised here; a skill's `normalizedName` is a
 * string transform. Asking a model to do deterministic work invites it to be
 * creative about it.
 *
 * Every field the document might omit is nullable, and every list can be empty,
 * so "not stated" has an honest representation. Without one, a required field
 * is an invitation to invent a plausible value.
 */

const resumeLink = z.object({
  /** e.g. "GitHub". Null when the document shows a bare URL. */
  label: z.string().nullable(),
  url: z.string(),
})

const resumeExperience = z.object({
  company: z.string(),
  title: z.string(),
  location: z.string().nullable(),
  /** Verbatim, e.g. "Jan 2019" or "2019". Parsed into a date on our side. */
  startDateRaw: z.string().nullable(),
  /** Verbatim. Null when the document says the role is ongoing. */
  endDateRaw: z.string().nullable(),
  isCurrent: z.boolean(),
  summary: z.string().nullable(),
  /** The bullet points, one string each, as written. */
  highlights: z.array(z.string()),
})

const resumeEducation = z.object({
  institution: z.string(),
  degree: z.string().nullable(),
  field: z.string().nullable(),
  startDateRaw: z.string().nullable(),
  endDateRaw: z.string().nullable(),
  grade: z.string().nullable(),
})

const resumeSkill = z.object({
  name: z.string(),
  category: z.enum(SKILL_CATEGORIES),
})

const resumeProject = z.object({
  name: z.string(),
  description: z.string().nullable(),
  technologies: z.array(z.string()),
  url: z.string().nullable(),
  startDateRaw: z.string().nullable(),
  endDateRaw: z.string().nullable(),
})

export const extractedResumeSchema = z.object({
  fullName: z.string().nullable(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  location: z.string().nullable(),
  /** The line under the name, e.g. "Senior Backend Engineer". */
  headline: z.string().nullable(),
  summary: z.string().nullable(),
  /**
   * An estimate the model reasons out from the roles listed, not something the
   * document usually states. Fractional, because half a year matters.
   */
  yearsExperienceTotal: z.number().nullable(),
  links: z.array(resumeLink),
  experiences: z.array(resumeExperience),
  education: z.array(resumeEducation),
  skills: z.array(resumeSkill),
  projects: z.array(resumeProject),
  /** Stored as `extras` until something queries them structurally. */
  certifications: z.array(z.string()),
  languages: z.array(z.string()),
})

/**
 * The whole response.
 *
 * `valid` is the guardrail: the model decides whether the document is a CV at
 * all, and a `false` leaves `resume` null rather than inventing one from a
 * restaurant menu. Both halves come back in a single call, so an invalid
 * document costs one request rather than two.
 */
export const resumeExtractionResponseSchema = z.object({
  valid: z.boolean(),
  /** One short sentence on what the document is instead. Null when valid. */
  rejectionReason: z.string().nullable(),
  resume: extractedResumeSchema.nullable(),
})

export type ExtractedResume = z.infer<typeof extractedResumeSchema>
export type ResumeExtractionResponse = z.infer<typeof resumeExtractionResponseSchema>

/** Ready to hand to Gemini as `responseSchema`. */
export const RESUME_EXTRACTION_RESPONSE_SCHEMA = toGeminiSchema(resumeExtractionResponseSchema)
