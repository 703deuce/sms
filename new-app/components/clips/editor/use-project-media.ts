'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { clipsFetch } from '@/lib/clips-api'
import { uploadClipFile, type UploadProgress } from '@/lib/clips/upload'
import type { ProjectMediaItem } from '@/lib/clips/editor/media-add'
import type { MediaTranscript, MediaTranscriptEstimate } from '@/lib/clips/editor/media-words'

/** Browser-side probe (no upload needed): duration / size; images via <img>, audio / video via <video>. */
async function probeMedia(file: File): Promise<{ durationMs?: number; width?: number; height?: number }> {
  const url = URL.createObjectURL(file)
  try {
    if (file.type.startsWith('image/')) {
      return await new Promise((resolve) => {
        const img = new Image()
        img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight })
        img.onerror = () => resolve({})
        img.src = url
      })
    }
    return await new Promise((resolve) => {
      const el = document.createElement(file.type.startsWith('audio/') ? 'audio' : 'video')
      el.preload = 'metadata'
      el.onloadedmetadata = () => {
        const v = el as HTMLVideoElement
        resolve({
          durationMs: Number.isFinite(el.duration) ? Math.round(el.duration * 1000) : undefined,
          ...(v.videoWidth ? { width: v.videoWidth, height: v.videoHeight } : {}),
        })
      }
      el.onerror = () => resolve({})
      el.src = url
    })
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
}

export const MEDIA_ACCEPT = 'video/*,image/*,audio/*'

export type MediaUploadRow = UploadProgress & { key: string }

/**
 * E5 project media library for the editor: list (uploads + Rooms angles), upload through the existing
 * signed-upload path (kind 'media'), register, detach, audio-sync. Polls while a sync is queued.
 */
export function useProjectMedia(projectId: string | null, transcriptsApi?: MediaTranscriptsApi) {
  const [items, setItems] = useState<ProjectMediaItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [uploads, setUploads] = useState<MediaUploadRow[]>([])
  const alive = useRef(true)
  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
    }
  }, [])

  const refresh = useCallback(async () => {
    if (!projectId) return
    setLoading(true)
    try {
      const data = await clipsFetch<{ items: ProjectMediaItem[] }>(`/api/clips/projects/${projectId}/library`)
      if (alive.current) {
        setItems(data.items)
        setError(null)
      }
    } catch (e) {
      if (alive.current) setError(e instanceof Error ? e.message : 'Could not load media')
    } finally {
      if (alive.current) setLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const syncing = items.some((i) => i.syncStatus === 'queued')
  useEffect(() => {
    if (!syncing) return
    const t = setInterval(() => void refresh(), 4000)
    return () => clearInterval(t)
  }, [syncing, refresh])

  const uploadFiles = useCallback(
    async (files: File[]): Promise<ProjectMediaItem[]> => {
      if (!projectId) return []
      const created: ProjectMediaItem[] = []
      for (const file of files) {
        const key = `${file.name}:${file.size}:${Date.now()}`
        const set = (p: UploadProgress) =>
          alive.current && setUploads((prev) => [...prev.filter((u) => u.key !== key), { ...p, key }])
        try {
          const meta = await probeMedia(file)
          const { uploadId } = await uploadClipFile(file, set, { kind: 'media' })
          const data = await clipsFetch<{ item: ProjectMediaItem }>(`/api/clips/projects/${projectId}/library`, {
            method: 'POST',
            body: JSON.stringify({ uploadId, label: file.name, ...meta }),
          })
          if (alive.current) {
            setItems((prev) => [data.item, ...prev.filter((i) => i.id !== data.item.id)])
            setUploads((prev) => prev.filter((u) => u.key !== key))
            created.push(data.item)
          }
        } catch (e) {
          set({
            filename: file.name,
            bytes: file.size,
            loaded: 0,
            percent: 0,
            state: 'error',
            error: e instanceof Error ? e.message : 'Upload failed',
          })
        }
      }
      return created
    },
    [projectId],
  )

  const remove = useCallback(
    async (id: string) => {
      if (!projectId) return
      await clipsFetch(`/api/clips/projects/${projectId}/library/${id}`, { method: 'DELETE' })
      if (alive.current) setItems((prev) => prev.filter((i) => i.id !== id))
    },
    [projectId],
  )

  const syncAudio = useCallback(
    async (id: string) => {
      if (!projectId) return
      const data = await clipsFetch<{ item: ProjectMediaItem }>(`/api/clips/projects/${projectId}/library/${id}/sync`, {
        method: 'POST',
        body: '{}',
      })
      if (alive.current) setItems((prev) => prev.map((i) => (i.id === id ? data.item : i)))
    },
    [projectId],
  )

  const dismissUpload = useCallback((key: string) => setUploads((prev) => prev.filter((u) => u.key !== key)), [])

  return {
    items,
    loading,
    error,
    uploads,
    refresh,
    uploadFiles,
    remove,
    syncAudio,
    dismissUpload,
    transcripts: transcriptsApi?.transcripts,
    estimateTranscript: transcriptsApi?.estimateTranscript,
    transcribe: transcriptsApi?.transcribe,
  }
}

/** E5b fields are optional so callers / tests built for E5 keep working. */
export type ProjectMediaApi = Omit<ReturnType<typeof useProjectMedia>, keyof MediaTranscriptsApi> & Partial<MediaTranscriptsApi>

/**
 * E5b: on-demand transcripts of the project's uploads / Rooms takes (cost estimate first, then queue).
 * Called once by the editor (its words join the transcript) and handed to useProjectMedia.
 */
export function useMediaTranscripts(projectId: string | null) {
  const alive = useRef(true)
  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
    }
  }, [])
  const [transcripts, setTranscripts] = useState<MediaTranscript[]>([])
  const refreshTranscripts = useCallback(async () => {
    if (!projectId) return
    try {
      const data = await clipsFetch<{ items: MediaTranscript[] }>(`/api/clips/projects/${projectId}/media-transcripts`)
      if (alive.current) setTranscripts(data.items)
    } catch {
      /* optional feature: the library still works without transcripts */
    }
  }, [projectId])
  useEffect(() => {
    void refreshTranscripts()
  }, [refreshTranscripts])
  const transcribing = transcripts.some((t) => t.status === 'queued' || t.status === 'running')
  useEffect(() => {
    if (!transcribing) return
    const t = setInterval(() => void refreshTranscripts(), 5000)
    return () => clearInterval(t)
  }, [transcribing, refreshTranscripts])

  const estimateTranscript = useCallback(
    async (item: Pick<ProjectMediaItem, 'ref' | 'refId'>): Promise<MediaTranscriptEstimate> => {
      if (!projectId) throw new Error('No project')
      const q = new URLSearchParams({ ref: item.ref, refId: item.refId })
      const data = await clipsFetch<{ estimate: MediaTranscriptEstimate }>(`/api/clips/projects/${projectId}/media-transcripts?${q}`)
      return data.estimate
    },
    [projectId],
  )

  const transcribe = useCallback(
    async (item: Pick<ProjectMediaItem, 'ref' | 'refId'>, acceptedCredits: number) => {
      if (!projectId) return
      const data = await clipsFetch<{ item: MediaTranscript }>(`/api/clips/projects/${projectId}/media-transcripts`, {
        method: 'POST',
        body: JSON.stringify({ ref: item.ref, refId: item.refId, acceptedCredits }),
      })
      if (alive.current) setTranscripts((prev) => [...prev.filter((t) => t.refId !== data.item.refId), data.item])
    },
    [projectId],
  )

  return { transcripts, estimateTranscript, transcribe }
}

export type MediaTranscriptsApi = ReturnType<typeof useMediaTranscripts>

/** Signed URL of an upload / Rooms track referenced by the edits (null until the library loads). */
export function mediaUrlFor(items: readonly ProjectMediaItem[], refId: string | undefined | null): string | null {
  if (!refId) return null
  return items.find((i) => i.refId === refId)?.url ?? null
}
