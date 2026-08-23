'use client'

import { useCallback, useEffect, useState } from 'react'
import { JOBS_PAGE_SIZE, isTerminalJobStatus } from '@cv-jobs-compatibility/constants'
import type { JobListResponse } from '@cv-jobs-compatibility/types'
import { errorMessage } from './api'
import { fetchJobs } from './jobs-api'

/**
 * One page of the account's postings.
 *
 * Re-reads itself while any posting on the page is still being parsed, so a
 * card that says "reading" becomes a card that says what the role is without
 * anyone reaching for the reload button. The poll stops the moment every
 * posting on the page has finished, which for a settled list is immediately.
 */

const POLL_INTERVAL_MS = 3000

export interface JobsState {
  data: JobListResponse | null
  loading: boolean
  error: string | null
  /** After removing one, so the page below does not go stale. */
  reload: () => void
}

export function useJobs(page: number, pageSize: number = JOBS_PAGE_SIZE): JobsState {
  const [data, setData] = useState<JobListResponse | null>(null)
  // Only the first load blanks the page; a poll or a reload leaves what is
  // there on screen rather than flashing a spinner over it.
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloads, setReloads] = useState(0)

  const reload = useCallback(() => setReloads((count) => count + 1), [])

  useEffect(() => {
    let cancelled = false

    fetchJobs(page, pageSize)
      .then((response) => {
        if (cancelled) return
        setData(response)
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
  }, [page, pageSize, reloads])

  const waiting = data?.items.some((job) => !isTerminalJobStatus(job.status)) ?? false

  useEffect(() => {
    if (!waiting) return

    const timer = setTimeout(reload, POLL_INTERVAL_MS)

    return () => clearTimeout(timer)
  }, [waiting, data, reload])

  return { data, loading, error, reload }
}
