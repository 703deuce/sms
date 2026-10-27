'use client'

import { createContext, useContext, useMemo, useState } from 'react'
import type { ClipProjectListItem } from '@/lib/clips/project-list-item'

type ClipsDriveContextValue = {
  search: string
  setSearch: (v: string) => void
  transcribingOpen: boolean
  setTranscribingOpen: (v: boolean) => void
  transcribingTitle: string
  setTranscribingTitle: (v: string) => void
  syncing: boolean
  setSyncing: (v: boolean) => void
  activityProjects: ClipProjectListItem[]
  setActivityProjects: (projects: ClipProjectListItem[]) => void
}

const ClipsDriveContext = createContext<ClipsDriveContextValue | null>(null)

export function ClipsDriveProvider({ children }: { children: React.ReactNode }) {
  const [search, setSearch] = useState('')
  const [transcribingOpen, setTranscribingOpen] = useState(false)
  const [transcribingTitle, setTranscribingTitle] = useState('')
  const [syncing, setSyncing] = useState(false)
  const [activityProjects, setActivityProjects] = useState<ClipProjectListItem[]>([])
  const value = useMemo(
    () => ({
      search,
      setSearch,
      transcribingOpen,
      setTranscribingOpen,
      transcribingTitle,
      setTranscribingTitle,
      syncing,
      setSyncing,
      activityProjects,
      setActivityProjects,
    }),
    [search, transcribingOpen, transcribingTitle, syncing, activityProjects],
  )
  return <ClipsDriveContext.Provider value={value}>{children}</ClipsDriveContext.Provider>
}

export function useClipsDrive() {
  const ctx = useContext(ClipsDriveContext)
  if (!ctx) throw new Error('useClipsDrive must be used within ClipsDriveProvider')
  return ctx
}

export function useClipsDriveOptional() {
  return useContext(ClipsDriveContext)
}
