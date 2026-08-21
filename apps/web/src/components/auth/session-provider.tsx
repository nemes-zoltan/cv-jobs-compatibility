'use client'

import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { MeResponse } from '@cv-jobs-compatibility/types'
import { Button, Spinner } from '@cv-jobs-compatibility/components'
import { ApiError } from '@/lib/api'
import { getMe, logout } from '@/lib/auth-api'

/**
 * Holds the signed-in user for everything inside the app shell, and is the
 * check that actually decides whether a session is real.
 *
 * The proxy's cookie test runs first and is only a hint. This asks the API, so
 * a session marker left behind by an account deletion, a rotated signing key,
 * or a logout the browser never saw all end the same way: back at the login
 * form.
 *
 * Children render only once a user exists, which is why `useSession` can hand
 * back a `MeResponse` rather than something possibly null. The cost is that the
 * shell waits on one request before painting - acceptable while every page
 * behind it needs the user anyway, and worth revisiting if a page turns up that
 * does not.
 *
 * The request is client-side rather than server-rendered because it has to be
 * able to refresh: a server component that got a `401` could neither retry
 * behind a new access token nor set the cookie it came back with, and access
 * tokens expire far more often than sessions end.
 */

interface Session {
  user: MeResponse
  signOut: () => Promise<void>
}

const SessionContext = createContext<Session | null>(null)

export function useSession(): Session {
  const session = useContext(SessionContext)
  if (!session) throw new Error('useSession must be used inside a SessionProvider')

  return session
}

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [user, setUser] = useState<MeResponse | null>(null)
  const [unreachable, setUnreachable] = useState(false)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let active = true

    const check = async () => {
      try {
        const me = await getMe()
        if (active) setUser(me)
        return
      } catch (error) {
        // A request that never got an answer says nothing about the session,
        // which may be perfectly good. Ending it here would sign people out
        // over a dropped connection, so this waits to be retried instead.
        if (error instanceof ApiError && error.status === 0) {
          if (active) setUnreachable(true)
          return
        }
      }

      // The session is over. Clearing the cookies is what makes the redirect
      // stick: the proxy reads the session marker, so leaving it in place would
      // bounce the browser straight back here - and around again. Redirecting
      // only once the API confirms the cookies are gone is what keeps that loop
      // from being possible at all.
      try {
        await logout()
      } catch {
        if (active) setUnreachable(true)
        return
      }

      if (active) {
        router.replace('/login')
        router.refresh()
      }
    }

    void check()

    return () => {
      active = false
    }
  }, [router, attempt])

  const signOut = useCallback(async () => {
    // Unlike the check above, a failure here is not worth stranding someone on
    // a page they asked to leave. If the API was unreachable the cookies
    // survive, the proxy sends them back to the app, and the session they still
    // have carries on - visibly odd, but not broken.
    await logout().catch(() => undefined)
    router.replace('/login')
    router.refresh()
  }, [router])

  if (unreachable) {
    return (
      <div className="flex min-h-svh flex-col items-center justify-center gap-4 px-6 text-center">
        <div className="flex flex-col gap-1">
          <p className="font-medium">Can&apos;t reach the server</p>
          <p className="text-sm text-muted-foreground">
            Your session is still fine. Check your connection and try again.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => {
            setUnreachable(false)
            setAttempt((count) => count + 1)
          }}
        >
          Try again
        </Button>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="flex min-h-svh items-center justify-center">
        <Spinner className="size-6 text-muted-foreground" aria-label="Loading your session" />
      </div>
    )
  }

  return <SessionContext.Provider value={{ user, signOut }}>{children}</SessionContext.Provider>
}
