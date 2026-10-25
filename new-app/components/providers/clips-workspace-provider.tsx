'use client'

import { createContext, useContext } from 'react'
import { featuresAllUnlocked } from '@/lib/billing/entitlements'

type ClipsWorkspaceState = {
  workspaceName: string
  testMode: boolean
}

const ClipsWorkspaceCtx = createContext<ClipsWorkspaceState>({
  workspaceName: 'Workspace',
  testMode: true,
})

export function ClipsWorkspaceProvider({
  children,
  workspaceName = 'Workspace',
}: {
  children: React.ReactNode
  workspaceName?: string
}) {
  const value = { workspaceName, testMode: featuresAllUnlocked() }
  return <ClipsWorkspaceCtx.Provider value={value}>{children}</ClipsWorkspaceCtx.Provider>
}

export function useClipsWorkspace() {
  return useContext(ClipsWorkspaceCtx)
}
