import { ThemeToggle } from '@/components/theme-toggle'
import { UserMenu } from '@/components/user-menu'
import { Wordmark } from '@/components/wordmark'

/**
 * Mirrors the auth screens' header - wordmark left, controls right - so signing
 * in does not shift the two fixed points on the page.
 */
export function AppHeader() {
  return (
    <header className="sticky top-0 z-10 border-b border-border bg-background/80 backdrop-blur-sm">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-3 md:px-10">
        <Wordmark />

        <div className="flex items-center gap-1">
          <ThemeToggle />
          <UserMenu />
        </div>
      </div>
    </header>
  )
}
