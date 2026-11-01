'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
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
import type { SourceWord } from '@/lib/clips/source-words'
import { wordSourceMs } from '@/lib/clips/source-words'

const FINAL = new Set(['READY', 'FAILED'])

export function useFullVideoHighlights(projectId: string, fullVideo: boolean, editorWords: SourceWord[]) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [highlightsOn, setHighlightsOn] = useState(false)
  const [foundProjectId, setFoundProjectId] = useState<string | null>(null)
  const [picks, setPicks] = useState<HighlightPick[]>([])
  const [status, setStatus] = useState<string | null>(null)
  const [ranges, setRanges] = useState<HighlightRange[]>([])
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null)

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

  const load = useCallback(async () => {
    if (!fullVideo) return
    const res = await fetchProjectHighlights(projectId)
    const data = res.data
    if (!data) {
      setPicks([])
      setRanges([])
      setFoundProjectId(null)
      setStatus(null)
      return
    }
    setFoundProjectId(data.foundProjectId)
    setStatus(data.status)
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
    if (!fullVideo || !highlightsOn) return
    void load().catch(() => {
      /* optional lane */
    })
  }, [fullVideo, highlightsOn, load])

  useEffect(() => {
    if (!fullVideo || !highlightsOn || !status || FINAL.has(status)) return
    const t = window.setInterval(() => {
      void load().catch(() => {})
    }, 4000)
    return () => window.clearInterval(t)
  }, [fullVideo, highlightsOn, status, load])

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

  const onRangeChange = useCallback((clipId: string, next: { startMs: number; endMs: number }) => {
    setRanges((rs) =>
      rs.map((r) => (r.pick.clipId === clipId ? { ...r, startMs: next.startMs, endMs: next.endMs } : r)),
    )
  }, [])

  const onMakeClip = useCallback(
    async (pick: HighlightPick, range: HighlightRange) => {
      if (!foundProjectId) return
      try {
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
    [foundProjectId, router],
  )

  const onMakeAll = useCallback(async () => {
    if (!foundProjectId) return
    const moved = ranges.filter((r) => r.startMs !== r.pick.startMs || r.endMs !== r.pick.endMs)
    for (const r of moved) {
      await makeClipFromPick(foundProjectId, r.pick, r)
    }
    router.push(`/app/clips/${foundProjectId}`)
  }, [foundProjectId, ranges, router])

  const onOpenCard = useCallback(
    (pick: HighlightPick) => {
      if (!foundProjectId) return
      router.push(`/app/clips/${foundProjectId}/edit/${pick.clipId}`)
    },
    [foundProjectId, router],
  )

  const onSelectPick = useCallback((clipId: string, startMs: number) => {
    setSelectedClipId(clipId)
    return startMs
  }, [])

  return {
    highlightsOn,
    persistToggle,
    picks,
    ranges,
    status,
    selectedClipId,
    setSelectedClipId,
    highlightWordIdx,
    momentRows,
    onRangeChange,
    onMakeClip,
    onMakeAll,
    onOpenCard,
    onSelectPick,
    hasPicks: picks.length > 0,
  }
}
