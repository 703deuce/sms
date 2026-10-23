import { AppShell } from '@/components/shell/app-shell'
import { PowerDialerImpersonationBanner } from '@/components/power-dialer/impersonation-banner'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell>
      <PowerDialerImpersonationBanner />
      {children}
    </AppShell>
  )
}
