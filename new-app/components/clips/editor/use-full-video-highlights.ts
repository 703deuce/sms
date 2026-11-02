'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { clipsFetch } from '@/lib/clips-api'
import {
  fetchProjectHighlights,
  makeClipFromPick,
} from '@/lib/clips/editor/make-clip-from-pick'
import {
  highlightRangesFromPicks,
  pickWordHighlight,
  visualMomentRows,
  type HighlightPick,
  type HighlightRange,
} from '@/lib/clips/editor/highlights'
import type { Timebase } from '@/lib/clips/editor/clip-timeline'
import { sourceMsToEditorMs } from '@/lib/clips/editor/source-ms-to-editor'
import type { InOut } from '@/lib/clips/editor/timeline-edit-ops'
import type { SourceWord } from '@/lib/clips/source-words'
import { wordSourceMs } from '@/lib/clips/source-words'

const PROJECT_FINAL = new Set(['READY', 'FAILED'])
const JOB_ACTIVE = new Set(['QUEUED', 'RUNNING'])

export type FullVideoHighlightsSeekApi = {
  seekSource: (sourceMs: number) => void
  timelineTb: Timebase
  setInOut: (io: InOut) => void
}

export function useFullVideoHighlights(
  projectId: string,
  fullVideo: boolean,
  editorWords: SourceWord[],
  seekApi?: FullVideoHighlightsSeekApi,
) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [highlightsOn, setHighlightsOn] = useState(false)
  const [source, setSource] = useState<'find' | 'project' | null>(null)
  const [foundProjectId, setFoundProjectId] = useState<string | null>(null)
  const [picks, setPicks] = useState<HighlightPick[]>([])
  const [status, setStatus] = useState<string | null>(null)
  const [progress, setProgress] = useState<number | null>(null)
  const [ranges, setRanges] = useState<HighlightRange[]>([])
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null)
  const prevStatusRef = useRef<string | null>(null)

  useEffect(() => {
    if (!fullVideo) return
    try {
      const fromUrl = searchParams.get('highlights') === '1'
      const stored = localStorage.getItem(`transovo.highlights.${projectId}`)
      setHighlightsOn(fromUrl || stored === '1')
    } catch {
      setHighlightsOn(searchParams.get('highlights') === '1')
    }
  }, [fullVideo, projectId, searchParams])

  const persistToggle = useCallback(
    (on: boolean) => {
      setHighlightsOn(on)
      try {
        localStorage.setItem(`transovo.highlights.${projectId}`, on ? '1' : '0')
      } catch {
        /* private mode */
      }
    },
    [projectId],
  )

  const turnOn = useCallback(() => persistToggle(true), [persistToggle])

  const load = useCallback(async () => {
    if (!fullVideo) return
    const res = await fetchProjectHighlights(projectId)
    const data = res.data
    if (!data) {
      setPicks([])
      setRanges([])
      setFoundProjectId(null)
      setStatus(null)
      setProgress(null)
      setSource(null)
      return
    }
    setSource(data.source ?? 'project')
    setFoundProjectId(data.foundProjectId ?? null)
    setStatus(data.status)
    setProgress(typeof data.progress === 'number' ? data.progress : null)
    setPicks(data.picks)
    setRanges((prev) => {
      if (!prev.length) return highlightRangesFromPicks(data.picks)
      const byId = new Map(prev.map((r) => [r.pick.clipId, r]))
      return data.picks.map((p) => {
        const existing = byId.get(p.clipId)
        return existing ? { ...existing, pick: p } : { pick: p, startMs: p.startMs, endMs: p.endMs }
      })
    })
  }, [fullVideo, projectId])

  useEffect(() => {
    if (!fullVideo) return
    void load().catch(() => {
      /* optional lane */
    })
  }, [fullVideo, load])

  const jobActive = Boolean(status && JOB_ACTIVE.has(status))

  useEffect(() => {
    if (!fullVideo || !jobActive) return
    const t = window.setInterval(() => {
      void load().catch(() => {})
    }, 4000)
    return () => window.clearInterval(t)
  }, [fullVideo, jobActive, load])

  useEffect(() => {
    if (source !== 'find') return
    const prev = prevStatusRef.current
    if (prev && JOB_ACTIVE.has(prev) && status === 'DONE') {
      toast.success(`Found ${picks.length} moment${picks.length === 1 ? '' : 's'}`)
    }
    prevStatusRef.current = status
  }, [status, source, picks.length])

  const startedFind = useCallback(() => {
    turnOn()
    void load().catch(() => {})
  }, [turnOn, load])

  const wordSpans = useMemo(
    () => editorWords.map((w) => ({ i: w.i, ...wordSourceMs(w) })),
    [editorWords],
  )

  const highlightWordIdx = useMemo(
    () => pickWordHighlight(wordSpans, picks, ranges),
    [wordSpans, picks, ranges],
  )

  const momentRows = useMemo(
    () => visualMomentRows(wordSpans, picks, ranges),
    [wordSpans, picks, ranges],
  )

  const selectAndSeek = useCallback(
    (clipId: string) => {
      const pick = picks.find((p) => p.clipId === clipId)
      const range = ranges.find((r) => r.pick.clipId === clipId)
      if (!pick || !range) return
      setSelectedClipId(clipId)
      seekApi?.seekSource(range.startMs)
      if (seekApi) {
        const a = sourceMsToEditorMs(seekApi.timelineTb, range.startMs)
        const b = sourceMsToEditorMs(seekApi.timelineTb, range.endMs)
        seekApi.setInOut({ in: Math.min(a.ms, b.ms), out: Math.max(a.ms, b.ms) })
      }
    },
    [picks, ranges, seekApi],
  )

  const selectNext = useCallback(() => {
    if (!picks.length) return
    const idx = picks.findIndex((p) => p.clipId === selectedClipId)
    const next = picks[(idx + 1 + picks.length) % picks.length]
    selectAndSeek(next.clipId)
  }, [picks, selectedClipId, selectAndSeek])

  const selectPrev = useCallback(() => {
    if (!picks.length) return
    const idx = picks.findIndex((p) => p.clipId === selectedClipId)
    const prev = picks[(idx - 1 + picks.length) % picks.length]
    selectAndSeek(prev.clipId)
  }, [picks, selectedClipId, selectAndSeek])

  const onRangeChange = useCallback((clipId: string, next: { startMs: number; endMs: number }) => {
    setRanges((rs) =>
      rs.map((r) => (r.pick.clipId === clipId ? { ...r, startMs: next.startMs, endMs: next.endMs } : r)),
    )
  }, [])

  const postFindMakeClip = useCallback(
    async (pick: HighlightPick, range: HighlightRange) =>
      clipsFetch<{ clipId: string; projectId: string }>(
        `/api/clips/projects/${encodeURIComponent(projectId)}/highlights/make-clip`,
        {
          method: 'POST',
          body: JSON.stringify({
            startMs: range.startMs,
            endMs: range.endMs,
            title: pick.title,
            reasonTag: pick.reasonTag,
            score: pick.score,
            why: pick.why,
            findJobId: pick.findJobId,
          }),
        },
      ),
    [projectId],
  )

  const onMakeClip = useCallback(
    async (pick: HighlightPick, range: HighlightRange) => {
      try {
        if (pick.origin === 'find') {
          const res = await postFindMakeClip(pick, range)
          toast.success('Clip created', {
            action: {
              label: 'Open',
              onClick: () => router.push(`/app/clips/${res.projectId}/edit/${res.clipId}`),
            },
          })
          return
        }
        if (!foundProjectId) return
        const res = await makeClipFromPick(foundProjectId, pick, range)
        if (res.navigated === 'existing') {
          router.push(`/app/clips/${foundProjectId}/edit/${res.clipId}`)
          return
        }
        toast.success('New clip created', {
          action: { label: 'Open', onClick: () => router.push(`/app/clips/${foundProjectId}/edit/${res.clipId}`) },
        })
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Make clip failed')
      }
    },
    [foundProjectId, projectId, router, postFindMakeClip],
  )

  const onMakeAll = useCallback(async () => {
    if (source === 'find') {
      let openProjectId: string | null = null
      for (const r of ranges) {
        const res = await postFindMakeClip(r.pick, r)
        openProjectId = res.projectId
      }
      toast.success(`${ranges.length} clips created · Open project`, {
        action: openProjectId
          ? { label: 'Open', onClick: () => router.push(`/app/clips/${openProjectId}`) }
          : undefined,
      })
      return
    }
    if (!foundProjectId) return
    const moved = ranges.filter((r) => r.startMs !== r.pick.startMs || r.endMs !== r.pick.endMs)
    for (const r of moved) {
      await makeClipFromPick(foundProjectId, r.pick, r)
    }
    router.push(`/app/clips/${foundProjectId}`)
  }, [source, ranges, postFindMakeClip, foundProjectId, router])

  useEffect(() => {
    if (!fullVideo || !highlightsOn || !status || PROJECT_FINAL.has(status) || jobActive) return
    const t = window.setInterval(() => {
      void load().catch(() => {})
    }, 4000)
    return () => window.clearInterval(t)
  }, [fullVideo, highlightsOn, status, jobActive, load])

  const onOpenCard = useCallback(
    (pick: HighlightPick) => {
      if (pick.origin === 'find') return
      if (!foundProjectId) return
      router.push(`/app/clips/${foundProjectId}/edit/${pick.clipId}`)
    },
    [foundProjectId, router],
  )

  const isJobRunning = jobActive
  const hasPicks = picks.length > 0
  const showHighlightsList = hasPicks || isJobRunning

  return {
    highlightsOn,
    persistToggle,
    turnOn,
    startedFind,
    picks,
    ranges,
    status,
    progress,
    source,
    selectedClipId,
    setSelectedClipId,
    selectAndSeek,
    selectNext,
    selectPrev,
    highlightWordIdx,
    momentRows,
    onRangeChange,
    onMakeClip,
    onMakeAll,
    onOpenCard,
    hasPicks,
    isJobRunning,
    showHighlightsList,
  }
}
