import type {
  JobMatchEssentialModel,
  JobMatchModel,
  JobMatchQuestionModel,
  JobMatchSummaryModel,
} from '@cv-jobs-compatibility/types'
import type {
  JobMatchRequirementRow,
  JobMatchRow,
  JobMatchSkillRow,
  JobRequirementRow,
  JobSkillRow,
} from '../database/schema'

/**
 * A match as a page renders it.
 *
 * The judgement rows are joined back to the posting's own wording here rather
 * than on the client: a report that says "3 stars" without saying what was
 * being graded is unreadable, and the client should not have to fetch the
 * posting again to find out.
 */
export interface MatchWithRows {
  match: JobMatchRow
  requirements: { judgement: JobMatchRequirementRow; requirement: JobRequirementRow }[]
  skills: { judgement: JobMatchSkillRow; skill: JobSkillRow }[]
}

export function toJobMatchSummaryModel(match: JobMatchRow): JobMatchSummaryModel {
  return {
    id: match.id,
    status: match.status,
    score: match.score,
    verdict: match.verdict,
    recommendation: match.recommendation,
    updatedAt: match.updatedAt.toISOString(),
  }
}

export function toJobMatchModel({ match, requirements, skills }: MatchWithRows): JobMatchModel {
  return {
    ...toJobMatchSummaryModel(match),
    essentials: (match.essentials ?? []) as JobMatchEssentialModel[],
    meetsYearsRequirement: match.meetsYearsRequirement,
    summary: match.summary,
    strengths: match.strengths ?? [],
    gaps: match.gaps ?? [],

    requirements: requirements.map(({ judgement, requirement }) => ({
      id: judgement.id,
      text: requirement.text,
      importance: requirement.importance,
      kind: requirement.kind,
      stars: judgement.stars,
      evidence: judgement.evidence,
    })),

    skills: skills.map(({ judgement, skill }) => ({
      id: judgement.id,
      name: skill.name,
      category: skill.category,
      importance: skill.importance,
      verdict: judgement.verdict,
      gapType: judgement.gapType,
      evidence: judgement.evidence,
    })),

    tailoredQuestions: (match.tailoredQuestions ?? []) as JobMatchQuestionModel[],
  }
}
