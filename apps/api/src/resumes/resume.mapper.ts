import type { ResumeLinkModel, ResumeModel } from '@cv-jobs-compatibility/types'
import type {
  ResumeEducationRow,
  ResumeExperienceRow,
  ResumeProjectRow,
  ResumeRow,
  ResumeSkillRow,
} from '../database/schema'

export interface ResumeWithSections {
  resume: ResumeRow
  experiences: ResumeExperienceRow[]
  education: ResumeEducationRow[]
  skills: ResumeSkillRow[]
  projects: ResumeProjectRow[]
}

/** What `resumes.extras` holds. Loose by design - it is where anything not yet
 * queried structurally goes. */
interface ResumeExtras {
  certifications?: string[]
  languages?: string[]
}

/**
 * A resume and its children, as a page renders them.
 *
 * Two things are deliberately dropped. `normalizedName` is a comparison key,
 * not something to read. And every parsed date is left behind in favour of the
 * string the document actually used: `startDate` is a guess that turns "2019"
 * into the first of January and goes null whenever the parser gave up, so it
 * earns its place in queries and nowhere near a screen.
 */
export function toResumeModel({
  resume,
  experiences,
  education,
  skills,
  projects,
}: ResumeWithSections): ResumeModel {
  const extras = (resume.extras ?? {}) as ResumeExtras

  return {
    id: resume.id,
    fullName: resume.fullName,
    email: resume.email,
    phone: resume.phone,
    location: resume.location,
    headline: resume.headline,
    summary: resume.summary,
    // `numeric` comes back as a string, and the contract says number.
    yearsExperienceTotal:
      resume.yearsExperienceTotal === null ? null : Number(resume.yearsExperienceTotal),
    links: (resume.links ?? []) as ResumeLinkModel[],
    certifications: extras.certifications ?? [],
    languages: extras.languages ?? [],

    experiences: experiences.map((row) => ({
      id: row.id,
      company: row.company,
      title: row.title,
      location: row.location,
      start: row.startDateRaw,
      end: row.endDateRaw,
      isCurrent: row.isCurrent,
      summary: row.summary,
      highlights: row.highlights ?? [],
    })),

    education: education.map((row) => ({
      id: row.id,
      institution: row.institution,
      degree: row.degree,
      field: row.field,
      start: row.startDateRaw,
      end: row.endDateRaw,
      grade: row.grade,
    })),

    skills: skills.map((row) => ({ id: row.id, name: row.name, category: row.category })),

    projects: projects.map((row) => ({
      id: row.id,
      name: row.name,
      description: row.description,
      technologies: row.technologies ?? [],
      url: row.url,
      start: row.startDateRaw,
      end: row.endDateRaw,
    })),

    createdAt: resume.createdAt.toISOString(),
  }
}
