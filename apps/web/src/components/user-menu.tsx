'use client'

import { LogOutIcon } from 'lucide-react'
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@cv-jobs-compatibility/components'
import { useSession } from '@/components/auth/session-provider'

/**
 * Initials rather than a generic avatar icon: two letters at most, from the
 * first and last word of the name. A single word gives a single letter, which
 * is better than inventing a second one.
 */
function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return '?'

  const first = words[0][0]
  const last = words.length > 1 ? words[words.length - 1][0] : ''

  return `${first}${last}`.toUpperCase()
}

export function UserMenu() {
  const { user, signOut } = useSession()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="rounded-full"
          aria-label="Account menu"
        >
          <span className="flex size-7 items-center justify-center rounded-full bg-muted text-xs font-medium">
            {initials(user.name)}
          </span>
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="min-w-56">
        {/* Not a DropdownMenuLabel: two lines of different weight read better as
            their own block, and there is nothing to label. */}
        <div className="flex flex-col gap-0.5 px-2 py-1.5">
          <span className="text-sm font-medium">{user.name}</span>
          <span className="truncate text-xs text-muted-foreground">
            {user.email}
          </span>
        </div>

        <DropdownMenuSeparator />

        <DropdownMenuItem onSelect={() => void signOut()}>
          <LogOutIcon />
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
