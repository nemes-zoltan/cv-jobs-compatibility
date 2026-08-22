'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { FileTextIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useSession } from '@/components/auth/session-provider'

/**
 * Links in the header rather than a sidebar.
 *
 * The wordmark is the way back to the dashboard, so it does not appear here
 * twice. Everything else is a destination.
 *
 * Renders nothing until a CV exists: onboarding is the whole app at that point,
 * and offering a link to an empty page is worse than offering none.
 */

const LINKS = [{ href: '/my-resume', label: 'My Resume', icon: FileTextIcon }]

export function AppNav() {
  const pathname = usePathname()
  const { user } = useSession()

  if (!user.hasResume) return null

  return (
    <nav className="flex items-center gap-5" aria-label="Main">
      {LINKS.map(({ href, label, icon: Icon }) => {
        const active = pathname === href

        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              // A bottom border rather than `underline`: it lines up across
              // items whatever the word, and does not cut through descenders.
              'flex items-center gap-1.5 border-b-2 py-0.5 text-sm transition-colors',
              active
                ? 'border-foreground font-medium text-foreground'
                : 'border-transparent text-muted-foreground hover:border-border hover:text-foreground',
            )}
          >
            <Icon className="size-4 shrink-0" />
            {label}
          </Link>
        )
      })}
    </nav>
  )
}
