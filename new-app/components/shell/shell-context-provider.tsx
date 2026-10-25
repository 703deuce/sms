'use client'

import { createContext, useContext, useMemo } from 'react'
import { usePathname } from 'next/navigation'
import { resolveContext, type NavContext } from '@/lib/nav'
import type { PersistedShellContext } from '@/lib/nav-shell-context'

const ShellContextState = createContext<PersistedShellContext | null>(null)

export function ShellContextProvider({
  initial,
  children,
}: {
  initial: PersistedShellContext | null
  children: React.ReactNode
}) {
  return <ShellContextState.Provider value={initial}>{children}</ShellContextState.Provider>
}

export function useShellPersistedContext(): PersistedShellContext | null {
  return useContext(ShellContextState)
}

export function useResolvedNavContext(): NavContext {
  const pathname = usePathname()
  return useMemo(() => resolveContext(pathname), [pathname])
}

export function useWorkspaceContactsNavEntry() {
  return () => {}
}

export function usePowerDialerCrmNavEntry() {
  return () => {}
}

export function shellContextKeyFromCookie(_value: string | undefined): null {
  return null
}
