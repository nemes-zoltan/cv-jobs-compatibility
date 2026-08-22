'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent } from '@cv-jobs-compatibility/components'
import { useSession } from '@/components/auth/session-provider'
import { ResumeOnboarding } from '@/components/resume/resume-onboarding'

/**
 * Getting a CV into the account, and nothing else.
 *
 * A client component because the decision it makes is about the session: an
 * account that already has a CV has no business here, and the check has to run
 * against a user that can be re-read after a worker finishes.
 */
export default function OnboardingPage() {
  const router = useRouter()
  const { user } = useSession()

  useEffect(() => {
    if (user.hasResume) router.replace('/')
  }, [user.hasResume, router])

  // Nothing rather than a flash of the upload box on the way out.
  if (user.hasResume) return null

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-6 py-16 md:px-10">
      <div className="flex flex-col gap-2 text-center">
        <h1 className="font-heading text-3xl font-semibold tracking-tight text-balance">
          Let&apos;s start with your CV
        </h1>
        <p className="text-sm text-muted-foreground text-pretty">
          Everything else is measured against it, so it only has to be done once.
        </p>
      </div>

      {/* `Card` draws itself with a ring and its own vertical padding; an empty
          state wants a dashed outline and room to breathe instead. */}
      <Card className="relative border border-dashed border-border bg-transparent py-0 ring-0">
        {/* The same dotted field as the auth showcase, so the two halves of the
            product look like one. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(var(--color-border)_1px,transparent_1px)] [background-size:18px_18px] [mask-image:radial-gradient(ellipse_at_50%_35%,black,transparent_70%)]"
        />

        <CardContent className="relative flex flex-col items-center px-6 py-14">
          <ResumeOnboarding />
        </CardContent>
      </Card>
    </div>
  )
}
