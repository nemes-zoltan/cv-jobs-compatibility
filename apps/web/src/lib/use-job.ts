'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  STALLED_JOB_SECONDS,
  TERMINAL_MATCH_STATUSES,
  isTerminalJobStatus,
} from '@cv-jobs-compatibility/constants'
import type { MatchStatus } from '@cv-jobs-compatibility/constants'
import type { JobModel } from '@cv-jobs-compatibility/types'
import { errorMessage } from './api'
import { createJobMatch, fetchJob, retryJobInsights } from './jobs-api'

/**
 * One posting, whole.
 *
 * Keeps polling while it is still being parsed, so arriving here straight from
 * the paste box shows the posting filling itself in rather than an empty page
 * that needs a reload.
 */

const POLL_INTERVAL_MS = 1500

/** The briefing searches the web, so it is a slower thing to wait on. */
const INSIGHTS_POLL_INTERVAL_MS = 4000

function isTerminalMatchStatus(status: MatchStatus): boolean {
  return (TERMINAL_MATCH_STATUSES as readonly string[]).includes(status)
}

export interface JobState {
  job: JobModel | null
  loading: boolean
  error: string | null
  /**
   * The briefing is not coming on its own: it failed, or it has been queued
   * long enough that nothing is working on it. What puts a retry button on the
   * page rather than a spinner that never resolves.
   */
  briefingNeedsRetry: boolean
  retryBriefing: () => Promise<void>
  /**
   * Whether the posting can be scored yet. The briefing is not an input to
   * scoring, so it only has to have settled - succeeded or failed. Requiring it
   * to have worked would let a briefing that can never succeed block scoring
   * forever.
   */
  canScore: boolean
  scoring: boolean
  score: () => Promise<void>
}

export function useJob(id: string): JobState {
  const [job, setJob] = useState<JobModel | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  const [scoring, setScoring] = useState(false)
  // Keeps the clock moving while nothing is arriving, so a briefing whose
  // worker died crosses into "needs retry" instead of spinning forever.
  const [, setTick] = useState(0)

  useEffect(() => {
    let cancelled = false

    fetchJob(id)
      .then((found) => {
        if (cancelled) return
        setJob(found)
        setError(null)
      })
      .catch((caught) => {
        if (!cancelled) setError(errorMessage(caught))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [id, attempt])

  const parsed = job !== null && isTerminalJobStatus(job.status)

  // Measured from the last change to the posting, which is when the briefing
  // was queued - `markReady` and a retry both touch it.
  const briefingStalled =
    job !== null &&
    job.insightsStatus === 'pending' &&
    Date.now() - new Date(job.updatedAt).getTime() > STALLED_JOB_SECONDS * 1000

  const briefingNeedsRetry = job !== null && (job.insightsStatus === 'failed' || briefingStalled)

  const scoreRunning =
    job?.match !== null && job?.match !== undefined && !isTerminalMatchStatus(job.match.status)

  // Three things can be in flight and they finish at different times: the
  // parse, the briefing queued once it succeeds, and a score somebody asked
  // for. Polling on any one of them alone leaves the others spinning until
  // someone reloads.
  const running =
    job !== null &&
    (!parsed || (job.insightsStatus === 'pending' && !briefingStalled) || scoreRunning)

  useEffect(() => {
    if (!running) return

    const timer = setTimeout(
      () => setAttempt((count) => count + 1),
      parsed ? INSIGHTS_POLL_INTERVAL_MS : POLL_INTERVAL_MS,
    )

    return () => clearTimeout(timer)
  }, [running, parsed, job])

  useEffect(() => {
    if (!running) return

    const timer = setInterval(() => setTick((count) => count + 1), 1000)

    return () => clearInterval(timer)
  }, [running])

  const retryBriefing = useCallback(async () => {
    setError(null)

    try {
      // The response is the posting with `insightsStatus` back to pending,
      // which is what restarts the poll above.
      setJob(await retryJobInsights(id))
    } catch (caught) {
      setError(errorMessage(caught))
    }
  }, [id])

  const score = useCallback(async () => {
    setError(null)
    setScoring(true)

    try {
      const match = await createJobMatch(id)
      // Folded into the posting we already hold rather than refetched: the
      // queued match is what the strip needs to start showing progress, and a
      // second round trip would only tell us the same thing.
      setJob((current) => (current ? { ...current, match } : current))
    } catch (caught) {
      setError(errorMessage(caught))
    } finally {
      setScoring(false)
    }
  }, [id])

  return {
    job,
    loading,
    error,
    briefingNeedsRetry,
    retryBriefing,
    canScore: job !== null && job.status === 'ready' && job.insightsStatus !== 'pending',
    scoring,
    score,
  }
}
