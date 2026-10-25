'use client'

import { createContext, useContext } from 'react'

/** Legacy Telnyx workspace provider removed — clips app uses ClipsWorkspaceProvider. */
const WorkspaceCtx = createContext(true)

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  return <WorkspaceCtx.Provider value={true}>{children}</WorkspaceCtx.Provider>
}

export function useWorkspace(): never {
  throw new Error('useWorkspace is not available in the clips app')
}
