'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { ClipEditsV2 } from '@/lib/clips/edits'
import type { Timebase } from '@/lib/clips/editor/clip-timeline'
import type { ProjectMediaItem } from '@/lib/clips/editor/media-add'
import type { MediaTranscript } from '@/lib/clips/editor/media-words'
import { insertFromSource, overwriteFromSource, transcriptLines, wordRangeMs } from '@/lib/clips/editor/source-monitor'

export type MonitorRequest = { itemId: string; mediaMs: number; seq: number }

const fmt = (ms: number) => {
  const s = Math.max(0, ms) / 1000
  return `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, '0')}`
}

/**
 * G1c source monitor (Premiere / Resolve style): play any project media, select transcript words
 * (or mark in / out on the monitor), then Insert (ripple) or Overwrite at the timeline playhead.
 * Match frame (F on the timeline) opens it at the playhead's source moment.
 */
export function SourceMonitor({
  items,
  transcripts,
  request,
  edits,
  tb,
  playheadOutMs,
  onEdits,
  readOnly,
}: {
  items: readonly ProjectMediaItem[]
  transcripts: readonly MediaTranscript[] | undefined
  request: MonitorRequest | null
  edits: ClipEditsV2
  tb: Timebase
  playheadOutMs: number
  onEdits: (next: ClipEditsV2) => void
  readOnly?: boolean
}) {
  const playable = useMemo(() => items.filter((i) => i.url && (i.mediaType === 'video' || i.mediaType === 'audio')), [items])
  const [itemId, setItemId] = useState<string | null>(null)
  const item = playable.find((i) => i.id === itemId) ?? null
  const mediaRef = useRef<HTMLVideoElement & HTMLAudioElement>(null)
  const [sel, setSel] = useState<{ a: number; b: number } | null>(null)
  const [marks, setMarks] = useState<{ inMs: number | null; outMs: number | null }>({ inMs: null, outMs: null })
  const [curMs, setCurMs] = useState(0)
  const pendingSeek = useRef<number | null>(null)

  // Match frame / "open" requests.
  useEffect(() => {
    if (!request) return
    setItemId(request.itemId)
    setSel(null)
    setMarks({ inMs: null, outMs: null })
    pendingSeek.current = request.mediaMs
    const el = mediaRef.current
    if (el && el.readyState >= 1 && item?.id === request.itemId) {
      el.currentTime = request.mediaMs / 1000
      pendingSeek.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request?.seq])

  const tr = item ? transcripts?.find((t) => t.ref === item.ref && t.refId === item.refId && t.status === 'done') : undefined
  const words = useMemo(() => tr?.words ?? [], [tr])
  const lines = useMemo(() => transcriptLines(words), [words])

  const range: [number, number] | null = sel
    ? wordRangeMs(words, sel.a, sel.b, 60, item?.durationMs)
    : marks.inMs != null && marks.outMs != null && marks.outMs > marks.inMs
      ? [marks.inMs, marks.outMs]
      : null

  const seek = (ms: number) => {
    const el = mediaRef.current
    if (el) el.currentTime = Math.max(0, ms / 1000)
  }
  const clickWord = (i: number, shift: boolean) => {
    setMarks({ inMs: null, outMs: null })
    setSel((s) => (shift && s ? { a: s.a, b: i } : { a: i, b: i }))
    seek(words[i]!.s * 1000)
  }
  const run = (kind: 'insert' | 'overwrite') => {
    if (!item || !range) return
    const f = kind === 'insert' ? insertFromSource : overwriteFromSource
    const res = f(edits, item, tb, playheadOutMs, range, () => crypto.randomUUID())
    if (!res.edits) {
      toast.message(res.message)
      return
    }
    onEdits(res.edits)
    if (res.message) toast.message(res.message)
  }
  const lo = sel ? Math.min(sel.a, sel.b) : -1
  const hi = sel ? Math.max(sel.a, sel.b) : -1

  return (
    <section className="space-y-2 rounded-md border p-2" data-testid="source-monitor">
      <div className="flex items-center gap-2 text-xs">
        <span className="font-semibold">Source monitor</span>
        <select
          className="min-w-0 flex-1 rounded border border-border bg-background px-1 py-0.5 text-[11px]"
          value={itemId ?? ''}
          onChange={(e) => {
            setItemId(e.target.value || null)
            setSel(null)
            setMarks({ inMs: null, outMs: null })
          }}
          data-testid="source-monitor-item"
        >
          <option value="">Pick media…</option>
          {playable.map((i) => (
            <option key={i.id} value={i.id}>
              {i.label}
              {i.isMain ? ' (main)' : ''}
            </option>
          ))}
        </select>
      </div>
      {item ? (
        <>
          {item.mediaType === 'video' ? (
            <video
              ref={mediaRef}
              src={item.url ?? undefined}
              className="aspect-video w-full rounded bg-black"
              controls
              playsInline
              preload="metadata"
              onLoadedMetadata={(e) => {
                if (pendingSeek.current != null) {
                  e.currentTarget.currentTime = pendingSeek.current / 1000
                  pendingSeek.current = null
                }
              }}
              onTimeUpdate={(e) => setCurMs(e.currentTarget.currentTime * 1000)}
              data-testid="source-monitor-media"
            />
          ) : (
            <audio
              ref={mediaRef}
              src={item.url ?? undefined}
              className="w-full"
              controls
              preload="metadata"
              onLoadedMetadata={(e) => {
                if (pendingSeek.current != null) {
                  e.currentTarget.currentTime = pendingSeek.current / 1000
                  pendingSeek.current = null
                }
              }}
              onTimeUpdate={(e) => setCurMs(e.currentTarget.currentTime * 1000)}
              data-testid="source-monitor-media"
            />
          )}
          <div className="flex flex-wrap items-center gap-1 text-[11px]">
            <span className="tabular-nums text-muted-foreground">{fmt(curMs)}</span>
            <Button size="xs" variant="outline" onClick={() => { setSel(null); setMarks((m) => ({ ...m, inMs: Math.round(curMs) })) }} data-testid="source-monitor-mark-in">
              In
            </Button>
            <Button size="xs" variant="outline" onClick={() => { setSel(null); setMarks((m) => ({ ...m, outMs: Math.round(curMs) })) }} data-testid="source-monitor-mark-out">
              Out
            </Button>
            <span className="tabular-nums text-muted-foreground" data-testid="source-monitor-range">
              {range ? `${fmt(range[0])}–${fmt(range[1])} (${((range[1] - range[0]) / 1000).toFixed(1)} s)` : 'Select words or mark in / out'}
            </span>
          </div>
          {lines.length ? (
            <div className="max-h-48 space-y-1 overflow-y-auto rounded border border-border/60 p-1 text-[12px] leading-relaxed" data-testid="source-monitor-transcript">
              {lines.map((ln) => (
                <p key={ln.i0} className="flex gap-1.5">
                  <button
                    type="button"
                    className="shrink-0 tabular-nums text-[10px] text-muted-foreground hover:text-foreground"
                    title="Select this line"
                    onClick={() => {
                      setMarks({ inMs: null, outMs: null })
                      setSel({ a: ln.i0, b: ln.i1 })
                      seek(ln.startMs)
                    }}
                    data-testid="source-monitor-line"
                  >
                    {fmt(ln.startMs)}
                  </button>
                  <span>
                    {words.slice(ln.i0, ln.i1 + 1).map((w, k) => {
                      const i = ln.i0 + k
                      return (
                        <span
                          key={i}
                          role="button"
                          tabIndex={0}
                          className={cn('cursor-pointer rounded px-px hover:bg-muted', i >= lo && i <= hi && 'bg-primary/25')}
                          onClick={(e) => clickWord(i, e.shiftKey)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') clickWord(i, e.shiftKey)
                          }}
                          data-testid="source-monitor-word"
                        >
                          {w.w}{' '}
                        </span>
                      )
                    })}
                  </span>
                </p>
              ))}
            </div>
          ) : (
            <p className="text-[11px] text-muted-foreground">
              {item.isMain ? 'The main video’s words are in the Transcript panel.' : 'No transcript for this file yet — transcribe it from its media card to pick by words, or use In / Out.'}
            </p>
          )}
          {!readOnly && !item.isMain ? (
            <div className="flex flex-wrap gap-1">
              <Button size="xs" disabled={!range} onClick={() => run('insert')} title="Ripple: plays at the playhead, everything after moves right" data-testid="source-monitor-insert">
                Insert at playhead
              </Button>
              {item.mediaType === 'video' ? (
                <Button size="xs" variant="outline" disabled={!range} onClick={() => run('overwrite')} title="Replaces the Video lane from the playhead for the same length" data-testid="source-monitor-overwrite">
                  Overwrite at playhead
                </Button>
              ) : null}
            </div>
          ) : null}
        </>
      ) : null}
    </section>
  )
}
