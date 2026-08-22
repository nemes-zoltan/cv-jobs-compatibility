'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  type ResumeIngestionStatus,
  STALLED_RESUME_UPLOAD_SECONDS,
  isTerminalResumeIngestionStatus,
} from '@cv-jobs-compatibility/constants'
import type { ResumeIngestionModel } from '@cv-jobs-compatibility/types'
import { errorMessage } from './api'
import {
  type UploadStage,
  deleteResumeUpload,
  fetchPendingResumeUpload,
  fetchResumeUpload,
  uploadResume,
} from './resume-api'

/**
 * One upload, from picking a file to a finished resume.
 *
 * Polling rather than a socket: the pipeline takes seconds, the access token is
 * short-lived and refreshes itself on any call, and a request every second and
 * a half costs less than a connection to maintain.
 */

const POLL_INTERVAL_MS = 1500

/** The pipeline never revisits a step, so its status maps onto one of three. */
const STEP_BY_STATUS: Record<ResumeIngestionStatus, number> = {
  // Uploaded but not picked up yet - reading it is what happens next.
  uploaded: 1,
  extracting: 1,
  analyzing: 2,
  ready: 3,
  rejected: 3,
  failed: 3,
}

/**
 * Which of the three steps is current, counting from zero. No record yet means
 * the file is still in the browser's hands, which is step one.
 */
export function resumeUploadStep(upload: ResumeIngestionModel | null): number {
  return upload ? STEP_BY_STATUS[upload.status] : 0
}

/** Nothing has moved for long enough that it probably never will. */
function isStalled(upload: ResumeIngestionModel): boolean {
  const sinceLastChange = Date.now() - new Date(upload.updatedAt).getTime()

  return sinceLastChange > STALLED_RESUME_UPLOAD_SECONDS * 1000
}

export interface ResumeUploadState {
  /** The initial check for work already in progress. */
  loading: boolean
  upload: ResumeIngestionModel | null
  /** Set only while the browser is still uploading, before any record exists. */
  stage: UploadStage | null
  error: string | null
  /** Unfinished, and stopped making progress a while ago. */
  stalled: boolean
  start: (file: File) => Promise<void>
  /** Throws the upload away so another one can be started. */
  discard: () => Promise<void>
}

export function useResumeUpload(): ResumeUploadState {
  const [loading, setLoading] = useState(true)
  const [upload, setUpload] = useState<ResumeIngestionModel | null>(null)
  const [stage, setStage] = useState<UploadStage | null>(null)
  const [error, setError] = useState<string | null>(null)
  // Recomputed on every poll, and once a second while nothing is arriving -
  // otherwise a stalled upload would only be noticed when a request happened to
  // come back.
  const [, setTick] = useState(0)

  // Work already in progress when the page loaded - a reload mid-pipeline, or
  // a second tab.
  useEffect(() => {
    let cancelled = false

    fetchPendingResumeUpload()
      .then((pending) => {
        if (!cancelled) setUpload(pending)
      })
      // A failure here is not worth surfacing: the upload box is the right
      // thing to show when we cannot tell whether anything is running.
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  const running = upload !== null && !isTerminalResumeIngestionStatus(upload.status)
  const stalled = running && isStalled(upload)

  // Re-runs on every answer, which is what keeps the poll going; one timer at a
  // time, and none at all once there is nothing left to wait for.
  useEffect(() => {
    if (!upload || !running || stalled) return

    const timer = setTimeout(() => {
      fetchResumeUpload(upload.id)
        .then(setUpload)
        .catch((caught) => setError(errorMessage(caught)))
    }, POLL_INTERVAL_MS)

    return () => clearTimeout(timer)
  }, [upload, running, stalled])

  // The clock has to keep moving even when the answers stop, or an upload whose
  // worker died would poll forever without ever crossing into "stalled".
  useEffect(() => {
    if (!running || stalled) return

    const timer = setInterval(() => setTick((count) => count + 1), 1000)

    return () => clearInterval(timer)
  }, [running, stalled])

  const start = useCallback(async (file: File) => {
    setError(null)

    try {
      setUpload(await uploadResume(file, setStage))
    } catch (caught) {
      setError(errorMessage(caught))
    } finally {
      setStage(null)
    }
  }, [])

  const discard = useCallback(async () => {
    if (!upload) return

    try {
      await deleteResumeUpload(upload.id)
      setUpload(null)
      setError(null)
    } catch (caught) {
      setError(errorMessage(caught))
    }
  }, [upload])

  return { loading, upload, stage, error, stalled, start, discard }
}
