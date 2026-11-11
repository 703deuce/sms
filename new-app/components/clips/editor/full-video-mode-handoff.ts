'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { clipsFetch } from '@/lib/clips-api'
import { writeClipEditorLayoutView } from '@/lib/clips/editor/editor-layout-view'

type FullVideoLinkData =
  | { projectId: string; clipId: string; url: string; sourceMs: number; preparing?: false }
  | { preparing: true; stage: 'project' | 'clip'; message: string; projectId?: string }

const SAVE_FAILED =
  'Save failed. Full video was not opened. Your changes are still here; retry the save and choose Full video again.'
const UNAVAILABLE =
  'Full video is unavailable because this clip has no completed source video to open.'
const RESOLVE_FAILED =
  'Full video could not be opened right now. Your changes are still here; retry Full video.'

export function useFullVideoModeHandoff(
  clipId: string,
  flushSave: () => Promise<unknown>,
  navigate: (url: string) => void = (url) => window.location.assign(url),
) {
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState<string | null>(null)
  const inFlightRef = useRef(false)
  const aliveRef = useRef(true)
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    aliveRef.current = true
    return () => {
      aliveRef.current = false
      if (pollRef.current) clearTimeout(pollRef.current)
    }
  }, [])

  const stop = useCallback(() => {
    inFlightRef.current = false
    if (aliveRef.current) {
      setLoading(false)
      setProgress(null)
    }
  }, [])

  const resolve = useCallback(
    async (attempt: number) => {
      try {
        const data = await clipsFetch<FullVideoLinkData | null>(
          `/api/clips/clips/${encodeURIComponent(clipId)}/full-video-link`,
        )
        if (!aliveRef.current) return

        if (data && 'url' in data && data.url) {
          try {
            // Preparation can take long enough for more edits to occur after the
            // first flush. Flush once more immediately before navigation.
            await flushSave()
          } catch {
            console.error('[editor:full-video-mode] handoff-save-failed', { clipId, phase: 'before-navigation' })
            toast.error(SAVE_FAILED)
            stop()
            return
          }
          writeClipEditorLayoutView('timeline')
          console.info('[editor:full-video-mode] handoff-ready', {
            clipId,
            fullVideoProjectId: data.projectId,
            fullVideoClipId: data.clipId,
          })
          navigate(data.url)
          return
        }

        if (data && 'preparing' in data && data.preparing) {
          const message = data.message || 'Preparing full video editor…'
          setProgress(message)
          toast.message(message, { id: `full-video-mode:${clipId}` })
          console.info('[editor:full-video-mode] handoff-preparing', {
            clipId,
            stage: data.stage,
            projectId: data.projectId ?? null,
            attempt,
          })
          pollRef.current = setTimeout(
            () => void resolve(attempt + 1),
            Math.min(2500 + attempt * 200, 8000),
          )
          return
        }

        console.info('[editor:full-video-mode] handoff-unavailable', { clipId })
        toast.error(UNAVAILABLE)
        stop()
      } catch (error) {
        if (!aliveRef.current) return
        console.error('[editor:full-video-mode] handoff-resolve-failed', {
          clipId,
          errorName: error instanceof Error ? error.name : 'UnknownError',
        })
        toast.error(RESOLVE_FAILED)
        stop()
      }
    },
    [clipId, flushSave, navigate, stop],
  )

  const open = useCallback(async () => {
    if (inFlightRef.current) {
      console.info('[editor:full-video-mode] handoff-already-running', { clipId })
      return
    }
    inFlightRef.current = true
    setLoading(true)
    setProgress('Opening full video…')
    console.info('[editor:full-video-mode] handoff-start', { clipId })
    try {
      await flushSave()
    } catch {
      console.error('[editor:full-video-mode] handoff-save-failed', { clipId, phase: 'before-resolution' })
      toast.error(SAVE_FAILED)
      stop()
      return
    }
    await resolve(0)
  }, [clipId, flushSave, resolve, stop])

  return { loading, progress, open }
}
