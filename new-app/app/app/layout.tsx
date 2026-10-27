import { cookies } from 'next/headers'
import { AppShell } from '@/components/shell/app-shell'
import { isRecordingFeatureEnabled } from '@/lib/server/clips/feature-gates'
import type { PersistedShellContext } from '@/lib/nav-shell-context'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies()
  const raw = cookieStore.get('transovo_shell_context')?.value
  const initialShellContext: PersistedShellContext | null = raw === 'workspace' ? 'workspace' : null
  const defaultSidebarOpen = cookieStore.get('sidebar_state')?.value !== 'false'

  return (
    <AppShell
      initialShellContext={initialShellContext}
      defaultSidebarOpen={defaultSidebarOpen}
      recordingNavEnabled={isRecordingFeatureEnabled()}
    >
      {children}
    </AppShell>
  )
}
