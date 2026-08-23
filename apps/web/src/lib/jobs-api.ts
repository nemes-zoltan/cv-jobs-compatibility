import type {
  CreateJobRequest,
  JobListResponse,
  JobMatchModel,
  JobMatchSummaryModel,
  JobModel,
  JobSummaryModel,
  PendingJobResponse,
} from '@cv-jobs-compatibility/types'
import { apiFetch } from './api'

/** Everything the browser does with job postings. */

export function fetchJobs(page: number, pageSize: number): Promise<JobListResponse> {
  return apiFetch(`/jobs?page=${page}&pageSize=${pageSize}`)
}

export function fetchJob(id: string): Promise<JobModel> {
  return apiFetch(`/jobs/${id}`)
}

export function createJob(request: CreateJobRequest): Promise<JobSummaryModel> {
  return apiFetch('/jobs', { method: 'POST', body: request })
}

/**
 * The posting still being read, if there is one. Lets a page reloaded mid-parse
 * pick up where it left off instead of offering a second paste box.
 */
export function fetchPendingJob(): Promise<PendingJobResponse> {
  return apiFetch('/jobs/pending')
}

/**
 * Asks for the briefing again. The way back from a rate-limited or
 * out-of-quota model call, which retrying on a timer never recovers from.
 */
export function retryJobInsights(id: string): Promise<JobModel> {
  return apiFetch(`/jobs/${id}/insights`, { method: 'POST' })
}

/**
 * Scores the posting against the caller's CV. Returns it queued; the page
 * polls from there.
 */
export function createJobMatch(id: string): Promise<JobMatchSummaryModel> {
  return apiFetch(`/jobs/${id}/match`, { method: 'POST' })
}

/** The whole report. Rejects with a 404 until the posting has been scored. */
export function fetchJobMatch(id: string): Promise<JobMatchModel> {
  return apiFetch(`/jobs/${id}/match`)
}

/** Takes it off the list. The posting itself is left where it is. */
export function deleteJob(id: string): Promise<void> {
  return apiFetch(`/jobs/${id}`, { method: 'DELETE' })
}
