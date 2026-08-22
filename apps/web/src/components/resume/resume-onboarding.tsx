'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangleIcon, CheckCircle2Icon, ClockIcon, FileUpIcon } from 'lucide-react'
import { Button, Spinner } from '@cv-jobs-compatibility/components'
import { useSession } from '@/components/auth/session-provider'
import { resumeUploadStep, useResumeUpload } from '@/lib/use-resume-upload'
import { ResumeIngestionProgress } from './resume-ingestion-progress'
import { ResumeUploadForm } from './resume-upload-form'

/**
 * Onboarding, from an empty account to a CV that is in.
 *
 * Owns the heading as well as the control below it because both change with the
 * same state, and an upload in progress under "No CV yet" reads as a bug.
 *
 * A rejection is described in our words, never the model's: that text is
 * written about a document a stranger uploaded, and rendering it would put
 * their content on someone else's screen.
 */
export function ResumeOnboarding() {
  const router = useRouter()
  const { refresh } = useSession()
  const { loading, upload, stage, error, stalled, start, discard } = useResumeUpload()
  const [leaving, setLeaving] = useState(false)

  const done = upload?.status === 'ready'

  // The session was read before this CV existed, and the page we are going to
  // routes on `hasResume` - so it has to be re-read before the redirect, or the
  // dashboard bounces straight back here.
  useEffect(() => {
    if (!done) return

    setLeaving(true)
    void refresh()
      .then(() => router.replace('/'))
      // A full load rather than a client navigation: the dashboard routes on
      // `hasResume`, and if re-reading the session failed the copy in memory
      // still says there is no CV. Reloading is the one thing guaranteed to
      // fetch it again instead of bouncing back here.
      .catch(() => window.location.assign('/'))
  }, [done, refresh, router])

  if (loading) {
    return (
      <div className="flex min-h-32 items-center justify-center">
        <Spinner className="size-5 text-muted-foreground" />
      </div>
    )
  }

  if (done || leaving) {
    return (
      <Panel
        icon={<CheckCircle2Icon className="size-5 text-muted-foreground" />}
        title="Your CV is in"
        description="Taking you to your dashboard."
      >
        <Spinner className="size-4 text-muted-foreground" />
      </Panel>
    )
  }

  if (stalled && upload) {
    return (
      <Panel
        icon={<ClockIcon className="size-5 text-muted-foreground" />}
        title="This is taking longer than it should"
        description="Processing has not moved for a few minutes. Start again with the same file or a different one."
      >
        <ResumeIngestionProgress step={resumeUploadStep(upload)} />
        <DiscardButton onDiscard={discard}>Delete and start over</DiscardButton>
        <ErrorLine message={error} />
      </Panel>
    )
  }

  if (upload && upload.status !== 'rejected' && upload.status !== 'failed') {
    return (
      <Panel icon={<FileUpIcon className="size-5 text-muted-foreground" />} title="Reading your CV">
        <ResumeIngestionProgress step={resumeUploadStep(upload)} />
      </Panel>
    )
  }

  if (upload) {
    const rejected = upload.status === 'rejected'

    return (
      <Panel
        icon={<AlertTriangleIcon className="size-5 text-muted-foreground" />}
        title={rejected ? 'That does not look like a CV' : 'We could not read that file'}
        description={
          rejected
            ? 'Upload a CV or resume - a record of your work history, education or skills.'
            : 'Something went wrong on our side, or the file had no readable text. A scanned CV will not work.'
        }
      >
        <DiscardButton onDiscard={discard}>Try another file</DiscardButton>
        <ErrorLine message={error} />
      </Panel>
    )
  }

  return (
    <Panel
      icon={<FileUpIcon className="size-5 text-muted-foreground" />}
      title="No CV yet"
      description="Upload one and every role you add gets scored against it."
    >
      <ResumeUploadForm onSubmit={start} disabled={stage !== null} />
      <ErrorLine message={error} />
    </Panel>
  )
}

/**
 * Every way out of a finished-but-unusable upload is the same delete, so the
 * button that does it is one component with different wording.
 */
function DiscardButton({
  onDiscard,
  children,
}: {
  onDiscard: () => Promise<void>
  children: React.ReactNode
}) {
  const [busy, setBusy] = useState(false)

  return (
    <Button
      variant="outline"
      disabled={busy}
      onClick={() => {
        setBusy(true)
        void onDiscard().finally(() => setBusy(false))
      }}
    >
      {busy && <Spinner />}
      {children}
    </Button>
  )
}

function ErrorLine({ message }: { message: string | null }) {
  if (!message) return null

  return (
    <p role="alert" className="text-sm text-destructive">
      {message}
    </p>
  )
}

interface PanelProps {
  icon: React.ReactNode
  title: string
  description?: string
  children: React.ReactNode
}

function Panel({ icon, title, description, children }: PanelProps) {
  return (
    // Fixed width so swapping the form for the progress bar does not resize the
    // card around it.
    <div className="flex w-full max-w-sm flex-col items-center gap-5 text-center">
      <span className="flex size-12 items-center justify-center rounded-xl border border-border bg-background">
        {icon}
      </span>

      <div className="flex flex-col gap-1.5">
        <h2 className="font-heading text-lg font-semibold tracking-tight">{title}</h2>
        {description && (
          <p className="text-sm leading-relaxed text-muted-foreground text-pretty">{description}</p>
        )}
      </div>

      {children}
    </div>
  )
}
