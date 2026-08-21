'use client'

import { useSession } from '@/components/auth/session-provider'

/**
 * The only part of the home page that needs the session, and therefore the only
 * part that needs to be a client component - the page around it stays on the
 * server.
 *
 * First name only: a full name in a greeting reads like a form letter.
 */
export function Greeting() {
  const { user } = useSession()

  return (
    <h1 className="font-heading text-3xl font-semibold tracking-tight text-balance">
      Welcome back, {user.name.trim().split(/\s+/)[0]}
    </h1>
  )
}
