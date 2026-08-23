'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangleIcon, CheckCircle2Icon, ClipboardPasteIcon, ClockIcon } from 'lucide-react'
import { Button, Card, CardContent, Spinner } from '@cv-jobs-compatibility/components'
import { useSession } from '@/components/auth/session-provider'
import { BackLink } from '@/components/back-link'
import { JobIngestionProgress } from '@/components/jobs/job-ingestion-progress'
import { JobPasteForm } from '@/components/jobs/job-paste-form'
import { jobIngestionStep, useJobCreation } from '@/lib/use-job-creation'

/**
 * Adding one posting, and nothing else.
 *
 * One at a time: the paste box is not offered while something is still being
 * read, because parsing costs a model call and a box that takes ten at once is
 * a box that spends ten. The API refuses a second regardless - this only makes
 * the refusal visible before someone types into it.
 *
 * A rejection is described in our words, never the model's. That text is
 * written about something a stranger pasted, and rendering it would put their
 * content on someone else's screen.
 */
export default function NewJobPage() {
  const router = useRouter()
  const { user } = useSession()
  const { loading, job, submitting, error, stalled, create, discard } = useJobCreation()
  const [leaving, setLeaving] = useState(false)

  const done = job?.status === 'ready'

  useEffect(() => {
    if (!user.hasResume) router.replace('/onboarding')
  }, [user.hasResume, router])

  // Straight to the posting once it is readable. Nothing here has to be
  // re-read first - unlike the CV, a posting changes no session state.
  useEffect(() => {
    if (!done || !job) return

    setLeaving(true)
    router.replace(`/jobs/${job.id}`)
  }, [done, job, router])

  if (!user.hasResume) return null

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-10 md:px-10 md:py-14">
      <BackLink href="/jobs" label="Back to roles" />

      <div className="flex flex-col gap-2">
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Add a posting</h1>
        <p className="text-sm text-muted-foreground text-pretty">
          Paste the advert. We read what the role asks for, so it can be measured against your CV.
        </p>
      </div>

      <Card>
        <CardContent className="flex flex-col items-center gap-5 px-6 py-8">
          <Body
            loading={loading}
            done={done || leaving}
            stalled={stalled}
            job={job}
            submitting={submitting}
            create={create}
            discard={discard}
          />

          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

type BodyProps = Pick<ReturnType<typeof useJobCreation>, 'job' | 'submitting' | 'create' | 'discard'> & {
  loading: boolean
  done: boolean
  stalled: boolean
}

function Body({ loading, done, stalled, job, submitting, create, discard }: BodyProps) {
  if (loading) {
    return (
      <div className="flex min-h-32 items-center justify-center">
        <Spinner className="size-5 text-muted-foreground" />
      </div>
    )
  }

  if (done) {
    return (
      <Panel
        icon={<CheckCircle2Icon className="size-5 text-muted-foreground" />}
        title="Read and filed"
        description="Taking you to the posting."
      >
        <Spinner className="size-4 text-muted-foreground" />
      </Panel>
    )
  }

  if (stalled && job) {
    return (
      <Panel
        icon={<ClockIcon className="size-5 text-muted-foreground" />}
        title="This is taking longer than it should"
        description="Nothing has moved for a while. Remove it and paste the advert again."
      >
        <JobIngestionProgress step={jobIngestionStep(job)} />
        <DiscardButton onDiscard={discard}>Remove and start over</DiscardButton>
      </Panel>
    )
  }

  if (job && job.status !== 'rejected' && job.status !== 'failed') {
    return (
      <Panel
        icon={<ClipboardPasteIcon className="size-5 text-muted-foreground" />}
        title="Reading the posting"
      >
        <JobIngestionProgress step={jobIngestionStep(job)} />
      </Panel>
    )
  }

  if (job) {
    const rejected = job.status === 'rejected'

    return (
      <Panel
        icon={<AlertTriangleIcon className="size-5 text-muted-foreground" />}
        title={rejected ? 'That does not look like a job posting' : 'We could not read that'}
        description={
          rejected
            ? 'Paste a job advert - what the role involves and what they are asking for.'
            : 'Something went wrong on our side. Remove it and paste the advert again.'
        }
      >
        <DiscardButton onDiscard={discard}>Try another posting</DiscardButton>
      </Panel>
    )
  }

  return <JobPasteForm onSubmit={create} disabled={submitting} />
}

/** Every way out of a posting that cannot be used is the same delete. */
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

function Panel({
  icon,
  title,
  description,
  children,
}: {
  icon: React.ReactNode
  title: string
  description?: string
  children: React.ReactNode
}) {
  return (
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
