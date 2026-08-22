'use client'

import { useEffect, useState } from 'react'
import type { ResumeModel } from '@cv-jobs-compatibility/types'
import { errorMessage } from './api'
import { fetchMyResume } from './resume-api'

/**
 * The account's CV.
 *
 * Client-side rather than server-rendered for the same reason as the session:
 * a server component that got a `401` could neither retry behind a refreshed
 * access token nor set the cookie that came back with it.
 */
export function useMyResume(): {
  resume: ResumeModel | null
  loading: boolean
  error: string | null
} {
  const [resume, setResume] = useState<ResumeModel | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    fetchMyResume()
      .then((found) => {
        if (!cancelled) setResume(found)
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
  }, [])

  return { resume, loading, error }
}
