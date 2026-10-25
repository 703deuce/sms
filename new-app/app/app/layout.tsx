import { cookies } from 'next/headers'
import { AppShell } from '@/components/shell/app-shell'
import type { PersistedShellContext } from '@/lib/nav-shell-context'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies()
  const raw = cookieStore.get('transovo_shell_context')?.value
  const initialShellContext: PersistedShellContext | null = raw === 'workspace' ? 'workspace' : null

  return <AppShell initialShellContext={initialShellContext}>{children}</AppShell>
}
