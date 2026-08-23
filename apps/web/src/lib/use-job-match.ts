'use client'

import { useEffect, useState } from 'react'
import { TERMINAL_MATCH_STATUSES } from '@cv-jobs-compatibility/constants'
import type { JobMatchModel } from '@cv-jobs-compatibility/types'
import { ApiError, errorMessage } from './api'
import { fetchJobMatch } from './jobs-api'

/**
 * The report for one posting.
 *
 * Keeps polling while the score is still being worked out, so arriving here
 * straight from pressing the button shows it fill in rather than a 404 that
 * needs a reload.
 */

const POLL_INTERVAL_MS = 2000

export interface JobMatchState {
  match: JobMatchModel | null
  loading: boolean
  error: string | null
  /** No score has been asked for yet, which is not an error worth shouting about. */
  notScored: boolean
}

export function useJobMatch(jobId: string): JobMatchState {
  const [match, setMatch] = useState<JobMatchModel | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notScored, setNotScored] = useState(false)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false

    fetchJobMatch(jobId)
      .then((found) => {
        if (cancelled) return
        setMatch(found)
        setNotScored(false)
        setError(null)
      })
      .catch((caught) => {
        if (cancelled) return
        // A posting nobody has scored is the ordinary case for this route, not
        // a failure - the page offers to score it rather than reporting a fault.
        if (caught instanceof ApiError && caught.status === 404) {
          setNotScored(true)
          return
        }
        setError(errorMessage(caught))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [jobId, attempt])

  const running =
    match !== null && !(TERMINAL_MATCH_STATUSES as readonly string[]).includes(match.status)

  useEffect(() => {
    if (!running) return

    const timer = setTimeout(() => setAttempt((count) => count + 1), POLL_INTERVAL_MS)

    return () => clearTimeout(timer)
  }, [running, match])

  return { match, loading, error, notScored }
}
