'use client'

import { createContext, useContext, useMemo, useState } from 'react'

type ClipsDriveContextValue = {
  search: string
  setSearch: (v: string) => void
  transcribingOpen: boolean
  setTranscribingOpen: (v: boolean) => void
  transcribingTitle: string
  setTranscribingTitle: (v: string) => void
  syncing: boolean
  setSyncing: (v: boolean) => void
}

const ClipsDriveContext = createContext<ClipsDriveContextValue | null>(null)

export function ClipsDriveProvider({ children }: { children: React.ReactNode }) {
  const [search, setSearch] = useState('')
  const [transcribingOpen, setTranscribingOpen] = useState(false)
  const [transcribingTitle, setTranscribingTitle] = useState('')
  const [syncing, setSyncing] = useState(false)
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
    }),
    [search, transcribingOpen, transcribingTitle, syncing],
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
