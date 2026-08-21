import { Wordmark } from '@/components/wordmark'
import { ThemeToggle } from '@/components/theme-toggle'
import { ShowcasePanel } from '@/components/auth/showcase-panel'

/**
 * Two-column shell shared by login and register: the form column stays
 * narrow and centred, and the showcase column is dropped entirely below `lg`
 * rather than stacked, so small screens get the form and nothing competing
 * with it.
 */
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="grid min-h-svh lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      <div className="flex flex-col gap-10 px-6 py-8 md:px-10">
        <header className="flex items-center justify-between">
          <Wordmark />
          <ThemeToggle />
        </header>

        <main className="flex flex-1 items-center justify-center pb-12">
          <div className="w-full max-w-sm">{children}</div>
        </main>
      </div>

      <ShowcasePanel />
    </div>
  )
}
