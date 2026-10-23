import { cookies } from 'next/headers'
import { AppShell } from '@/components/shell/app-shell'
import { PowerDialerImpersonationBanner } from '@/components/power-dialer/impersonation-banner'
import type { PersistedShellContext } from '@/lib/nav-shell-context'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies()
  const raw = cookieStore.get('transovo_shell_context')?.value
  const initialShellContext: PersistedShellContext | null =
    raw === 'power_dialer' || raw === 'workspace' ? raw : null

  return (
    <AppShell initialShellContext={initialShellContext}>
      <PowerDialerImpersonationBanner />
      {children}
    </AppShell>
  )
}
