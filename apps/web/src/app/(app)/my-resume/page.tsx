'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Spinner } from '@cv-jobs-compatibility/components'
import { BackLink } from '@/components/back-link'
import { useSession } from '@/components/auth/session-provider'
import { ResumeDetail } from '@/components/resume/resume-detail'
import { useMyResume } from '@/lib/use-my-resume'

/**
 * Everything parsed out of the uploaded CV.
 *
 * One account has one CV, so this needs no id. When that changes it becomes the
 * detail page for one of several and gains one - the layout below does not care
 * either way.
 */
export default function MyResumePage() {
  const router = useRouter()
  const { user } = useSession()
  const { resume, loading, error } = useMyResume()

  useEffect(() => {
    if (!user.hasResume) router.replace('/onboarding')
  }, [user.hasResume, router])

  if (!user.hasResume) return null

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-10 md:px-10 md:py-14">
      <BackLink />

      {loading && (
        <div className="flex min-h-48 items-center justify-center">
          <Spinner className="size-5 text-muted-foreground" aria-label="Loading your CV" />
        </div>
      )}

      {error && !loading && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      {resume && <ResumeDetail resume={resume} />}
    </div>
  )
}
