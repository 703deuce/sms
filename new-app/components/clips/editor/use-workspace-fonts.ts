'use client'

import { useEffect, useSyncExternalStore } from 'react'
import { loadWorkspaceFonts, subscribeWorkspaceFonts, workspaceFontsState } from '@/lib/clips/editor/workspace-fonts'

/** G3b: the workspace's uploaded fonts (fetched once per page when `load`; `version` bumps on change). */
export function useWorkspaceFonts(load = true) {
  const s = useSyncExternalStore(subscribeWorkspaceFonts, workspaceFontsState, workspaceFontsState)
  useEffect(() => {
    if (load) void loadWorkspaceFonts()
  }, [load])
  return s
}
