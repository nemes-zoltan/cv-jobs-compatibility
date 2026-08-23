'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  type JobStatus,
  STALLED_JOB_SECONDS,
  isTerminalJobStatus,
} from '@cv-jobs-compatibility/constants'
import type { CreateJobRequest, JobSummaryModel } from '@cv-jobs-compatibility/types'
import { errorMessage } from './api'
import { createJob, deleteJob, fetchJob, fetchPendingJob } from './jobs-api'

/**
 * One posting, from pasted text to something parsed.
 *
 * Polling rather than a socket, for the same reasons as the CV upload: the
 * pipeline takes seconds, every call refreshes the access token on its way
 * through, and a request every second and a half is cheaper than a connection
 * to keep alive.
 *
 * Only one posting at a time, which the API enforces and this mirrors: the
 * paste box is not offered while something is still being read.
 */

const POLL_INTERVAL_MS = 1500

/** The pipeline never revisits a step, so its status maps onto one of two. */
const STEP_BY_STATUS: Record<JobStatus, number> = {
  queued: 0,
  analyzing: 1,
  ready: 2,
  rejected: 2,
  failed: 2,
}

export function jobIngestionStep(job: JobSummaryModel | null): number {
  return job ? STEP_BY_STATUS[job.status] : 0
}

/** Nothing has moved for long enough that it probably never will. */
function isStalled(job: JobSummaryModel): boolean {
  return Date.now() - new Date(job.updatedAt).getTime() > STALLED_JOB_SECONDS * 1000
}

export interface JobCreationState {
  /** The initial check for a posting already being read. */
  loading: boolean
  job: JobSummaryModel | null
  /** True from submitting the text until the API answers. */
  submitting: boolean
  error: string | null
  /** Unfinished, and stopped making progress a while ago. */
  stalled: boolean
  create: (request: CreateJobRequest) => Promise<void>
  /** Takes the posting off the list so another can be added. */
  discard: () => Promise<void>
}

export function useJobCreation(): JobCreationState {
  const [loading, setLoading] = useState(true)
  const [job, setJob] = useState<JobSummaryModel | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Recomputed once a second while nothing is arriving - otherwise a posting
  // whose worker died would only be noticed as stalled when a request happened
  // to come back, and none will.
  const [, setTick] = useState(0)

  // Work already in progress when the page loaded: a reload mid-parse, or a
  // second tab.
  useEffect(() => {
    let cancelled = false

    fetchPendingJob()
      .then((pending) => {
        if (!cancelled) setJob(pending)
      })
      // Not worth surfacing. The paste box is the right thing to show when we
      // cannot tell whether anything is running.
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  const running = job !== null && !isTerminalJobStatus(job.status)
  const stalled = running && isStalled(job)

  // Re-runs on every answer, which is what keeps the poll going; one timer at a
  // time, and none once there is nothing left to wait for.
  useEffect(() => {
    if (!job || !running || stalled) return

    const timer = setTimeout(() => {
      fetchJob(job.id)
        .then(setJob)
        .catch((caught) => setError(errorMessage(caught)))
    }, POLL_INTERVAL_MS)

    return () => clearTimeout(timer)
  }, [job, running, stalled])

  useEffect(() => {
    if (!running || stalled) return

    const timer = setInterval(() => setTick((count) => count + 1), 1000)

    return () => clearInterval(timer)
  }, [running, stalled])

  const create = useCallback(async (request: CreateJobRequest) => {
    setError(null)
    setSubmitting(true)

    try {
      setJob(await createJob(request))
    } catch (caught) {
      setError(errorMessage(caught))
    } finally {
      setSubmitting(false)
    }
  }, [])

  const discard = useCallback(async () => {
    if (!job) return

    try {
      await deleteJob(job.id)
      setJob(null)
      setError(null)
    } catch (caught) {
      setError(errorMessage(caught))
    }
  }, [job])

  return { loading, job, submitting, error, stalled, create, discard }
}
