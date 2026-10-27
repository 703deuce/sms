'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { EditorWord } from '@/lib/clips/script-editor/to-editor-words'
import { groupSpeakerBlocks } from '@/lib/clips/script-editor/group-speaker-blocks'
import {
  findActiveWordIndex,
  formatScriptTimecode,
  sourceTimeMsFromVideo,
  videoTimeSecFromSourceMs,
} from '@/lib/clips/script-editor/sync-playhead'
import { loadScriptEditorLayout, saveScriptEditorLayout } from '@/lib/clips/script-editor/panel-layout'
import { deriveEdl, outputTimeToSourceMs, sourceMsToOutputTime } from '@/lib/clips/script-edl/derive-edl'
import { isSourceMsInEdl, nextKeptSourceMs, outputDurationMs } from '@/lib/clips/script-edl/edl-playback'
import {
  clampOutputMs,
  edlUsesOutputClock,
  sourceMsAtOutput,
} from '@/lib/clips/script-editor/output-playback'
import type { ScriptDocumentV1 } from '@/lib/clips/script-edl/types'
import { useScriptComposition } from '@/components/script-editor/use-script-composition'
import { scrollWordIntoTranscriptPane } from '@/lib/clips/script-editor/scroll-word-into-view'
import { TimelinePanel } from '@/components/script-editor/transport/timeline/timeline-panel'
import {
  buildWordChips,
  outputRangeForWordIndices,
  splitMarkerAfterWordIndex,
} from '@/lib/clips/script-editor/timeline-model'
import { ArrowLeft, Pause, Play, Redo2, Scissors, Undo2 } from 'lucide-react'

export type ScriptBootstrapView = {
  projectId: string
  title: string
  durationMs: number
  rangeStartMs: number
  wordCount: number
  sourceVideoUrl: string | null
  editorWords: EditorWord[]
  compositionId: string
  compositionRevision: number
  document: ScriptDocumentV1 | null
  clips: { id: string; title: string }[]
  status: string
}

function defaultDocument(words: EditorWord[]): ScriptDocumentV1 {
  const ids = words.map((w) => w.id)
  return { v: 1, keptWordIds: ids, deletedWordIds: [], wordOrder: ids }
}

export function ScriptEditorShell({ data }: { data: ScriptBootstrapView }) {
  const initialDoc = data.document ?? defaultDocument(data.editorWords)
  const { document, saveState, deleteWords, applyOp, undo, redo, canUndo, canRedo } = useScriptComposition({
    compositionId: data.compositionId,
    revision: data.compositionRevision,
    document: initialDoc,
  })

  const videoRef = useRef<HTMLVideoElement>(null)
  const transcriptRef = useRef<HTMLDivElement>(null)
  const layoutRef = useRef(loadScriptEditorLayout())
  const [scriptWidthPct, setScriptWidthPct] = useState(layoutRef.current.scriptWidthPct)
  const [timelineExpanded, setTimelineExpanded] = useState(layoutRef.current.timelineExpanded)
  const [timelineHeightPx, setTimelineHeightPx] = useState(layoutRef.current.timelineHeightPx)
  const [playheadMs, setPlayheadMs] = useState(data.rangeStartMs)
  const [playing, setPlaying] = useState(false)
  const [selAnchor, setSelAnchor] = useState<number | null>(null)
  const [selEnd, setSelEnd] = useState<number | null>(null)
  const [timelineFocused, setTimelineFocused] = useState(false)
  const [pxPerMs, setPxPerMs] = useState(0.08)
  const [scrollLeftPx, setScrollLeftPx] = useState(0)
  const dragSelectRef = useRef(false)
  const outputPlayAnchorRef = useRef<{ t: number; out0: number } | null>(null)
  const playheadMsRef = useRef(playheadMs)
  playheadMsRef.current = playheadMs

  const wordsById = useMemo(() => new Map(data.editorWords.map((w) => [w.id, w])), [data.editorWords])
  const edl = useMemo(() => deriveEdl(document, wordsById, { padMs: 0 }), [document, wordsById])
  const deletedSet = useMemo(() => new Set(document.deletedWordIds), [document.deletedWordIds])

  const orderedWords = useMemo(() => {
    const order = document.wordOrder ?? [...document.keptWordIds, ...document.deletedWordIds]
    return order.map((id) => wordsById.get(id)).filter((w): w is EditorWord => Boolean(w))
  }, [document, wordsById])

  const chips = useMemo(() => buildWordChips(document, orderedWords, edl, deletedSet), [document, orderedWords, edl, deletedSet])
  const blocks = useMemo(() => groupSpeakerBlocks(orderedWords), [orderedWords])
  const activeIndex = useMemo(() => findActiveWordIndex(orderedWords, playheadMs), [orderedWords, playheadMs])

  const outDur = outputDurationMs(edl) || data.durationMs
  const outputMs = sourceMsToOutputTime(playheadMs, edl) ?? Math.max(0, playheadMs - data.rangeStartMs)

  const persistLayout = useCallback(() => {
    saveScriptEditorLayout({
      scriptWidthPct,
      timelineExpanded,
      timelineHeightPx,
    })
  }, [scriptWidthPct, timelineExpanded, timelineHeightPx])

  useEffect(() => {
    persistLayout()
  }, [persistLayout])

  const syncFromVideo = useCallback(() => {
    const v = videoRef.current
    if (!v) return
    if (playing && edlUsesOutputClock(edl)) return
    let srcMs = sourceTimeMsFromVideo(v.currentTime, data.rangeStartMs)
    if (!isSourceMsInEdl(srcMs, edl)) {
      const jump = nextKeptSourceMs(srcMs, edl)
      if (jump != null) {
        v.currentTime = videoTimeSecFromSourceMs(jump, data.rangeStartMs)
        srcMs = jump
      }
    }
    setPlayheadMs(srcMs)
    setPlaying(!v.paused)
  }, [data.rangeStartMs, edl, playing])

  useEffect(() => {
    if (!playing || !edlUsesOutputClock(edl)) return
    const v = videoRef.current
    if (!v) return
    if (!outputPlayAnchorRef.current) {
      const out0 =
        sourceMsToOutputTime(playheadMsRef.current, edl) ??
        Math.max(0, playheadMsRef.current - data.rangeStartMs)
      outputPlayAnchorRef.current = { t: performance.now(), out0 }
    }
    const anchor = outputPlayAnchorRef.current
    let raf = 0
    const tick = () => {
      const out = clampOutputMs(anchor.out0 + (performance.now() - anchor.t), edl)
      if (out >= outDur - 8) {
        v.pause()
        setPlaying(false)
        outputPlayAnchorRef.current = null
        return
      }
      const src = sourceMsAtOutput(out, edl, playheadMsRef.current)
      v.currentTime = videoTimeSecFromSourceMs(src, data.rangeStartMs)
      setPlayheadMs(src)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [playing, edl, outDur, data.rangeStartMs])

  const seekToSourceMs = useCallback(
    (ms: number) => {
      const v = videoRef.current
      if (!v) return
      const t = videoTimeSecFromSourceMs(ms, data.rangeStartMs)
      v.currentTime = t
      setPlayheadMs(ms)
    },
    [data.rangeStartMs],
  )

  const seekToOutputMs = useCallback(
    (out: number) => {
      const src = outputTimeToSourceMs(out, edl)
      if (src != null) seekToSourceMs(src)
    },
    [edl, seekToSourceMs],
  )

  const wordIndex = useCallback((id: string) => orderedWords.findIndex((w) => w.id === id), [orderedWords])

  const selectedIds = useMemo(() => {
    if (selAnchor == null || selEnd == null) return new Set<string>()
    const lo = Math.min(selAnchor, selEnd)
    const hi = Math.max(selAnchor, selEnd)
    const ids = new Set<string>()
    for (let i = lo; i <= hi; i++) {
      const w = orderedWords[i]
      if (w && !deletedSet.has(w.id)) ids.add(w.id)
    }
    return ids
  }, [selAnchor, selEnd, orderedWords, deletedSet])

  const onWordPointerDown = (idx: number, w: EditorWord, shift: boolean) => {
    dragSelectRef.current = true
    if (shift && selAnchor != null) setSelEnd(idx)
    else {
      setSelAnchor(idx)
      setSelEnd(idx)
    }
    seekToSourceMs(w.t0Ms)
  }

  const onWordPointerEnter = (idx: number) => {
    if (!dragSelectRef.current) return
    setSelEnd(idx)
  }

  useEffect(() => {
    const endDrag = () => {
      dragSelectRef.current = false
    }
    window.addEventListener('mouseup', endDrag)
    window.addEventListener('pointerup', endDrag)
    return () => {
      window.removeEventListener('mouseup', endDrag)
      window.removeEventListener('pointerup', endDrag)
    }
  }, [])

  const onDeleteSelection = useCallback(() => {
    const ids = [...selectedIds]
    if (!ids.length && selAnchor != null) {
      const w = orderedWords[selAnchor]
      if (w && !deletedSet.has(w.id)) ids.push(w.id)
    }
    if (ids.length) {
      deleteWords(ids)
      setSelAnchor(null)
      setSelEnd(null)
    }
  }, [selectedIds, selAnchor, orderedWords, deletedSet, deleteWords])

  const onReplaceSelectionWithGap = useCallback(() => {
    if (selAnchor == null || selEnd == null) return
    const lo = Math.min(selAnchor, selEnd)
    const hi = Math.max(selAnchor, selEnd)
    const range = outputRangeForWordIndices(chips, orderedWords, lo, hi)
    if (!range) return
    const durMs = Math.max(1, Math.round(range.outHi - range.outLo))
    const wordIds: string[] = []
    for (let i = lo; i <= hi; i++) {
      const w = orderedWords[i]
      if (w && !deletedSet.has(w.id)) wordIds.push(w.id)
    }
    if (!wordIds.length) return
    applyOp({ type: 'replace_with_gap', wordIds, atOutMs: Math.round(range.outLo), durMs })
    setSelAnchor(null)
    setSelEnd(null)
  }, [selAnchor, selEnd, chips, orderedWords, deletedSet, applyOp])

  const onSplitAtPlayhead = useCallback(() => {
    applyOp({ type: 'add_split', outMs: Math.round(outputMs) })
  }, [applyOp, outputMs])

  const onZoom = useCallback(
    (factor: number, anchorOutMs: number) => {
      setPxPerMs((prev) => {
        const next = Math.min(0.5, Math.max(0.005, prev * factor))
        const anchorPx = anchorOutMs * prev
        const newAnchorPx = anchorOutMs * next
        setScrollLeftPx((s) => Math.max(0, s + (anchorPx - newAnchorPx)))
        return next
      })
    },
    [],
  )

  const onFit = useCallback(() => {
    const shell = globalThis.document.querySelector('[data-script-shell]') as HTMLElement | null
    const viewW = shell ? shell.clientWidth - 80 : 800
    setPxPerMs(Math.max(0.005, viewW / Math.max(1, outDur)))
    setScrollLeftPx(0)
  }, [outDur])

  const onTrimClipEdge = useCallback(
    (clipKey: string, edge: 'start' | 'end', deltaOutMs: number) => {
      if (Math.abs(deltaOutMs) < 20) return
      const clip = clipKey.match(/^src-(\d+)-(\d+)$/)
      if (!clip) return
      const outStart = Number(clip[1])
      const outEnd = Number(clip[2])
      const targetOut = edge === 'end' ? outEnd + deltaOutMs : outStart + deltaOutMs
      const ids: string[] = []
      if (edge === 'end' && deltaOutMs < 0) {
        for (const c of chips) {
          if (c.outStartMs >= targetOut && c.outStartMs <= outEnd) ids.push(c.wordId)
        }
        if (ids.length) deleteWords(ids)
      } else if (edge === 'end' && deltaOutMs > 0) {
        for (const w of orderedWords) {
          if (deletedSet.has(w.id)) continue
          const out = sourceMsToOutputTime(w.t1Ms, edl)
          if (out != null && out > outEnd && out <= targetOut) ids.push(w.id)
        }
        if (ids.length) applyOp({ type: 'restore_words', wordIds: ids })
      }
    },
    [chips, deleteWords, orderedWords, deletedSet, edl, applyOp],
  )

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return

      if (e.ctrlKey && e.altKey && e.key.toLowerCase() === 't') {
        e.preventDefault()
        setTimelineExpanded((v) => !v)
      }
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 's') {
        e.preventDefault()
        setTimelineExpanded((v) => !v)
      }

      if ((e.metaKey || e.ctrlKey) && (e.key === '=' || e.key === '+')) {
        e.preventDefault()
        onZoom(1.15, outputMs)
      }
      if ((e.metaKey || e.ctrlKey) && e.key === '-') {
        e.preventDefault()
        onZoom(1 / 1.15, outputMs)
      }

      if (e.key === 's' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault()
        onSplitAtPlayhead()
      }

      if (e.shiftKey && (e.key === 'Delete' || e.key === 'Backspace')) {
        e.preventDefault()
        onReplaceSelectionWithGap()
        return
      }

      if ((e.key === 'Delete' || e.key === 'Backspace') && !e.metaKey && !e.ctrlKey) {
        e.preventDefault()
        onDeleteSelection()
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault()
        undo()
      }
      if (
        (e.metaKey || e.ctrlKey) &&
        (e.key === 'y' || (e.key === 'z' && e.shiftKey) || (e.key === 'Z' && e.shiftKey))
      ) {
        e.preventDefault()
        redo()
      }

      if (timelineFocused && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
        e.preventDefault()
        const step = e.key === 'ArrowLeft' ? -33 : 33
        seekToOutputMs(Math.max(0, Math.min(outDur, outputMs + step)))
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [
    onDeleteSelection,
    onReplaceSelectionWithGap,
    onSplitAtPlayhead,
    onZoom,
    outputMs,
    outDur,
    redo,
    undo,
    timelineFocused,
    seekToOutputMs,
  ])

  useEffect(() => {
    const el = transcriptRef.current?.querySelector(`[data-word-idx="${activeIndex}"]`) ?? null
    scrollWordIntoTranscriptPane(transcriptRef.current, el)
  }, [activeIndex])

  const togglePlay = () => {
    const v = videoRef.current
    if (!v) return
    if (v.paused) {
      if (edlUsesOutputClock(edl)) {
        outputPlayAnchorRef.current = { t: performance.now(), out0: outputMs }
      }
      void v.play()
    } else {
      outputPlayAnchorRef.current = null
      v.pause()
    }
  }

  const onResizeStart = (e: React.MouseEvent) => {
    e.preventDefault()
    const startX = e.clientX
    const startPct = scriptWidthPct
    let latestPct = startPct
    const onMove = (ev: MouseEvent) => {
      const shell = (e.target as HTMLElement).closest('[data-script-shell]') as HTMLElement | null
      if (!shell) return
      const rect = shell.getBoundingClientRect()
      const delta = ev.clientX - startX
      const next = startPct + (delta / rect.width) * 100
      latestPct = Math.min(72, Math.max(28, next))
      setScriptWidthPct(latestPct)
    }
    const onUp = () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      saveScriptEditorLayout({ scriptWidthPct: latestPct, timelineExpanded, timelineHeightPx })
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  const onTimelineResizeStart = (e: React.MouseEvent) => {
    e.preventDefault()
    const startY = e.clientY
    const startH = timelineHeightPx
    let latest = startH
    const onMove = (ev: MouseEvent) => {
      latest = Math.min(480, Math.max(160, startH - (ev.clientY - startY)))
      setTimelineHeightPx(latest)
    }
    const onUp = () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      saveScriptEditorLayout({ scriptWidthPct, timelineExpanded, timelineHeightPx: latest })
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  const splitAfterIdx = useMemo(() => {
    const markers = new Map<number, true>()
    for (const ms of document.splitAtOutMs ?? []) {
      const idx = splitMarkerAfterWordIndex(document, orderedWords, edl, ms)
      if (idx != null) markers.set(idx, true)
    }
    return markers
  }, [document, orderedWords, edl])

  const durationLabel = formatScriptTimecode(outDur)
  const currentLabel = formatScriptTimecode(outputMs)

  return (
    <div data-script-shell className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-border bg-background">
      <header className="flex h-12 shrink-0 items-center gap-3 border-b border-border px-3">
        <Button size="sm" variant="ghost" render={<Link href={`/app/clips/${data.projectId}`} />}>
          <ArrowLeft className="size-4" aria-hidden />
          Back
        </Button>
        <Button size="sm" variant="ghost" disabled={!canUndo} onClick={() => undo()}>
          <Undo2 className="size-4" aria-hidden />
          Undo
        </Button>
        <Button size="sm" variant="ghost" disabled={!canRedo} onClick={() => redo()}>
          <Redo2 className="size-4" aria-hidden />
          Redo
        </Button>
        <Button size="sm" variant="ghost" onClick={onSplitAtPlayhead} title="Split (S)">
          <Scissors className="size-4" aria-hidden />
          Split
        </Button>
        <div className="min-w-0 flex-1 truncate text-sm font-medium">{data.title}</div>
        <span className="text-xs text-muted-foreground">
          {saveState === 'saving' ? 'Saving…' : saveState === 'error' ? 'Save failed' : 'Saved'}
        </span>
      </header>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden lg:flex-row">
          <section
            className="flex h-full min-h-0 min-w-0 flex-col border-b border-border lg:border-b-0 lg:border-r"
            style={{ flex: `0 0 ${scriptWidthPct}%` }}
          >
            <div className="border-b border-border px-4 py-2 text-xs text-muted-foreground">
              Select words · Delete cuts · Shift+Delete gap · S split
            </div>
            <div
              ref={transcriptRef}
              className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3 select-none"
              onFocus={() => setTimelineFocused(false)}
            >
              <div className="mx-auto max-w-[72ch] space-y-4 text-[17px] leading-relaxed">
                {blocks.map((block) => (
                  <div key={`${block.speakerId}-${block.startMs}`}>
                    <div className="mb-1 flex items-center gap-2 text-sm">
                      <span className="size-2 rounded-full" style={{ backgroundColor: block.color }} aria-hidden />
                      <span className="font-medium">{block.speakerLabel}</span>
                      <span className="text-muted-foreground">{formatScriptTimecode(block.startMs - data.rangeStartMs)}</span>
                    </div>
                    <p>
                      {block.words.map((w) => {
                        const idx = wordIndex(w.id)
                        const active = idx === activeIndex
                        const deleted = deletedSet.has(w.id)
                        const selected = selectedIds.has(w.id)
                        const showSplit = splitAfterIdx.has(idx)
                        return (
                          <span key={w.id} className="inline">
                            <button
                              type="button"
                              data-word-idx={idx}
                              onMouseDown={(e) => {
                                e.preventDefault()
                                onWordPointerDown(idx, w, e.shiftKey)
                              }}
                              onMouseEnter={() => onWordPointerEnter(idx)}
                              className={cn(
                                'mr-1 inline rounded-sm px-0.5 transition-colors',
                                w.isFiller && !deleted && 'text-muted-foreground line-through',
                                deleted && 'text-muted-foreground/60 line-through decoration-destructive/50',
                                active && !deleted && 'bg-primary/20',
                                selected && 'bg-sky-500/25',
                                !active && !deleted && 'hover:bg-muted/60',
                              )}
                            >
                              {w.text}
                            </button>
                            {showSplit && (
                              <span className="mx-0.5 text-primary" title="Edit boundary">
                                ¦
                              </span>
                            )}
                          </span>
                        )
                      })}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <div
            role="separator"
            aria-orientation="vertical"
            className="hidden w-2 shrink-0 cursor-col-resize bg-border/40 hover:bg-primary/30 lg:block"
            onMouseDown={onResizeStart}
          />

          <section className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
            <div className="flex min-h-0 flex-1 items-start justify-center overflow-hidden bg-muted/30 p-4">
              {data.sourceVideoUrl ? (
                <video
                  ref={videoRef}
                  className="max-h-full w-full max-w-full rounded-lg bg-black shadow-md object-contain"
                  src={data.sourceVideoUrl}
                  controls={false}
                  preload="metadata"
                  playsInline
                  onTimeUpdate={syncFromVideo}
                  onPlay={() => setPlaying(true)}
                  onPause={() => setPlaying(false)}
                  onClick={togglePlay}
                />
              ) : (
                <p className="text-sm text-muted-foreground">Source video unavailable.</p>
              )}
            </div>
          </section>
        </div>

        <div
          className="flex shrink-0 items-center justify-center gap-4 border-t border-border px-3 py-2 text-sm"
          onFocus={() => setTimelineFocused(true)}
          tabIndex={0}
        >
          <Button type="button" size="icon-sm" variant="outline" onClick={togglePlay} disabled={!data.sourceVideoUrl}>
            {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
          </Button>
          <span className="tabular-nums text-muted-foreground" title="Output timeline (after cuts)">
            {currentLabel} / {durationLabel}
          </span>
        </div>

        <TimelinePanel
          expanded={timelineExpanded}
          heightPx={timelineHeightPx}
          document={document}
          orderedWords={orderedWords}
          deletedSet={deletedSet}
          edl={edl}
          durationMs={outDur}
          outputMs={outputMs}
          videoUrl={data.sourceVideoUrl}
          selectedWordIds={selectedIds}
          selAnchor={selAnchor}
          selEnd={selEnd}
          pxPerMs={pxPerMs}
          scrollLeftPx={scrollLeftPx}
          onToggleExpanded={() => setTimelineExpanded((v) => !v)}
          onResizeStart={onTimelineResizeStart}
          onZoom={onZoom}
          onFit={onFit}
          onScrollLeft={setScrollLeftPx}
          onSeekOutput={seekToOutputMs}
          onSelectIndices={(lo, hi) => {
            setSelAnchor(lo)
            setSelEnd(hi)
          }}
          onPadDragEnd={(wordId, padMs) => applyOp({ type: 'set_pad_before', wordId, padMs })}
          onTrimClipEdge={onTrimClipEdge}
        />
      </div>
    </div>
  )
}
