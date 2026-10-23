'use client'

import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { usePathname } from 'next/navigation'
import { resolveContext, type ContextKey, type NavContext } from '@/lib/nav'
import type { RuntimeProfile } from '@/lib/receptionist/runtime-profile'
import {
  readPersistedShellContext,
  type PersistedShellContext,
  shellContextToNavKey,
  syncShellContextFromPath,
  writePersistedShellContext,
} from '@/lib/nav-shell-context'

const ShellContextState = createContext<PersistedShellContext | null>(null)

export function ShellContextProvider({
  initial,
  children,
}: {
  initial: PersistedShellContext | null
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const [persisted, setPersisted] = useState<PersistedShellContext | null>(initial)

  useEffect(() => {
    syncShellContextFromPath(pathname)
    setPersisted(readPersistedShellContext() ?? initial)
  }, [pathname, initial])

  return <ShellContextState.Provider value={persisted}>{children}</ShellContextState.Provider>
}

export function useShellPersistedContext(): PersistedShellContext | null {
  return useContext(ShellContextState)
}

export function useResolvedNavContext(receptionistProfile: RuntimeProfile): NavContext {
  const pathname = usePathname()
  const persisted = useShellPersistedContext()
  const shellContext = shellContextToNavKey(persisted)

  return useMemo(
    () => resolveContext(pathname, receptionistProfile, { shellContext }),
    [pathname, receptionistProfile, shellContext],
  )
}

export function useWorkspaceContactsNavEntry() {
  return () => writePersistedShellContext('workspace')
}

export function usePowerDialerCrmNavEntry() {
  return () => writePersistedShellContext('power_dialer')
}

export function shellContextKeyFromCookie(value: string | undefined): ContextKey | null {
  if (value === 'power_dialer') return 'power_dialer'
  if (value === 'workspace') return 'workspace'
  return null
}
