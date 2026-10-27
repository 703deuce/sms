'use client'

import { useCallback, useEffect, useState } from 'react'
import { clipsFetch } from '@/lib/clips-api'

export type ClipsFolderRow = { id: string; name: string }

export function useClipsFolders(enabled = true) {
  const [folders, setFolders] = useState<ClipsFolderRow[]>([])
  const [loading, setLoading] = useState(false)

  const refetch = useCallback(async () => {
    if (!enabled) return
    setLoading(true)
    try {
      const res = await clipsFetch<{ data: { folders: ClipsFolderRow[] } }>('/api/clips/folders')
      setFolders(res.data.folders ?? [])
    } catch {
      setFolders([])
    } finally {
      setLoading(false)
    }
  }, [enabled])

  useEffect(() => {
    void refetch()
  }, [refetch])

  useEffect(() => {
    if (!enabled) return
    const onChanged = () => void refetch()
    window.addEventListener('clips-folders-changed', onChanged)
    return () => window.removeEventListener('clips-folders-changed', onChanged)
  }, [enabled, refetch])

  return { folders, loading, refetch }
}
