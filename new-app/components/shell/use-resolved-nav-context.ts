'use client'

import { useEffect, useMemo, useState } from 'react'
import { usePathname } from 'next/navigation'
import { resolveContext, type NavContext } from '@/lib/nav'
import type { RuntimeProfile } from '@/lib/receptionist/runtime-profile'
import {
  readPersistedShellContext,
  shellContextToNavKey,
  syncShellContextFromPath,
  writePersistedShellContext,
} from '@/lib/nav-shell-context'

export function useResolvedNavContext(receptionistProfile: RuntimeProfile): NavContext {
  const pathname = usePathname()
  const [persisted, setPersisted] = useState(() => readPersistedShellContext())

  useEffect(() => {
    const next = syncShellContextFromPath(pathname)
    setPersisted(next ?? readPersistedShellContext())
  }, [pathname])

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
