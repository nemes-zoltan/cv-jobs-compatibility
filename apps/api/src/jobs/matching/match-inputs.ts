import type { MatchJobInput, MatchResumeInput } from '@cv-jobs-compatibility/prompt-schemas'
import type {
  JobRequirementRow,
  JobRow,
  JobSkillRow,
  ResumeEducationRow,
  ResumeExperienceRow,
  ResumeProjectRow,
  ResumeRow,
  ResumeSkillRow,
} from '../../database/schema'

/**
 * Rows as the match prompt sees them.
 *
 * Both documents were read once and turned into these tables; neither is read
 * again here. What that buys is a match that cannot reinterpret a CV differently
 * from the CV page, and a prompt of a couple of thousand tokens rather than the
 * several thousand two raw documents would cost.
 *
 * The numbering is the other half of it. Requirements and skills go over
 * numbered and come back by number, so a judgement always attaches to the row
 * it was made about - which asking a model to echo a uuid would not guarantee.
 */

export interface ResumeSections {
  resume: ResumeRow
  experiences: ResumeExperienceRow[]
  education: ResumeEducationRow[]
  skills: ResumeSkillRow[]
  projects: ResumeProjectRow[]
}

export function toMatchResumeInput({
  resume,
  experiences,
  education,
  skills,
  projects,
}: ResumeSections): MatchResumeInput {
  return {
    headline: resume.headline,
    summary: resume.summary,
    // `numeric` comes back as a string.
    yearsExperienceTotal:
      resume.yearsExperienceTotal === null ? null : Number(resume.yearsExperienceTotal),
    skills: skills.map((skill) => skill.name),
    experiences: experiences.map((row) => ({
      title: row.title,
      company: row.company,
      // The dates as the CV wrote them, not the parsed ones: "2019" should
      // reach the model as "2019" rather than as a confident 1 January.
      start: row.startDateRaw,
      end: row.endDateRaw,
      isCurrent: row.isCurrent,
      summary: row.summary,
      highlights: row.highlights ?? [],
    })),
    education: education.map((row) => ({
      institution: row.institution,
      degree: row.degree,
      field: row.field,
    })),
    projects: projects.map((row) => ({
      name: row.name,
      description: row.description,
      technologies: row.technologies ?? [],
    })),
  }
}

export function toMatchJobInput(
  job: JobRow,
  requirements: JobRequirementRow[],
  skills: JobSkillRow[],
): MatchJobInput {
  return {
    title: job.title,
    company: job.company,
    seniority: job.seniority,
    yearsExperienceMin: job.yearsExperienceMin === null ? null : Number(job.yearsExperienceMin),
    yearsExperienceMax: job.yearsExperienceMax === null ? null : Number(job.yearsExperienceMax),
    workMode: job.workMode,
    employmentType: job.employmentType,
    locations: job.locations ?? [],
    // One-based, because the model is being asked to read a numbered list and
    // people number lists from one.
    requirements: requirements.map((row, index) => ({
      index: index + 1,
      text: row.text,
      importance: row.importance,
      kind: row.kind,
    })),
    skills: skills.map((row, index) => ({
      index: index + 1,
      name: row.name,
      importance: row.importance,
    })),
  }
}
