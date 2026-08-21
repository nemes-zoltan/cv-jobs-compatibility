import { SessionProvider } from '@/components/auth/session-provider'
import { AppHeader } from '@/components/app-header'

/**
 * The shell every signed-in route renders inside. The proxy has already turned
 * away requests with no session cookie; the provider is what verifies there is
 * a session behind it.
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <div className="flex min-h-svh flex-col">
        <AppHeader />
        <main className="flex-1">{children}</main>
      </div>
    </SessionProvider>
  )
}
