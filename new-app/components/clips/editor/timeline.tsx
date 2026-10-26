'use client'

import type { BrollItem } from '@/lib/clips/broll'
import { BROLL_MIN_MS } from '@/lib/clips/broll'
import type { ClipEditsV2 } from '@/lib/clips/edits'
import { keepSegments, outputDurationMs, wordDisplayText } from '@/lib/clips/edits'
import { buildCaptionWords } from '@/lib/clips/caption-words'
import type { SourceWord } from '@/lib/clips/source-words'
import { wordSourceMs } from '@/lib/clips/source-words'
import { shotIndexAt } from '@/lib/clips/crop-shots'
import type { CropShot } from '@/lib/server/clips/clip-detail'
import { AudioWaveformLane } from '@/components/clips/editor/audio-waveform-lane'

export function Timeline({
  edits,
  words,
  shots,
  outputMs,
  clipOutputDurationMs,
  videoUrl = null,
  onSeekOutput,
  onTrimChange,
  onBrollChange,
}: {
  edits: ClipEditsV2
  words: SourceWord[]
  shots: CropShot[]
  outputMs: number
  clipOutputDurationMs: number
  videoUrl?: string | null
  onSeekOutput: (outputMs: number) => void
  onTrimChange: (trim: { in: number; out: number }) => void
  onBrollChange?: (id: string, patch: Partial<Pick<BrollItem, 'startMs' | 'endMs'>>) => void
}) {
  const span = Math.max(1, edits.trim.out - edits.trim.in)
  const outDur = outputDurationMs(edits)
  const widthPx = Math.max(640, Math.round(span / 20))
  const captionByI = new Map(buildCaptionWords(words, edits).map((c) => [c.i, c]))

  const outputToSource = (outMs: number) => {
    const segs = keepSegments(edits.trim.in, edits.trim.out, edits.cutRanges)
    let acc = 0
    for (const [a, b] of segs) {
      const len = b - a
      if (acc + len >= outMs) return a + (outMs - acc)
      acc += len
    }
    return edits.trim.out
  }

  const broll = edits.broll || []
  const audio = edits.audio
  const outSpan = Math.max(1, clipOutputDurationMs)

  const lanes = [
    { key: 'video', label: 'Video', top: 32, h: 32 },
    { key: 'audio', label: 'Audio', top: 88, h: 20 },
    { key: 'broll', label: 'B-roll', top: 112, h: 24 },
  ] as const

  return (
    <div className="min-w-0 overflow-x-auto rounded-lg border border-border bg-card/30 p-2">
      <div className="flex" style={{ width: widthPx + 56 }}>
        <div className="relative w-14 shrink-0 text-[10px] font-medium text-muted-foreground">
          {lanes.map((lane) => (
            <span
              key={lane.key}
              className="absolute left-0 flex items-center"
              style={{ top: lane.top, height: lane.h }}
            >
              {lane.label}
            </span>
          ))}
        </div>
        <div className="relative h-36 shrink-0" style={{ width: widthPx }}>
        <div className="absolute inset-x-0 top-8 h-8 rounded bg-muted">
          {words.map((w) => {
            const { startMs, endMs } = wordSourceMs(w)
            if (endMs < edits.trim.in || startMs > edits.trim.out) return null
            const left = ((startMs - edits.trim.in) / span) * 100
            const wPct = ((endMs - startMs) / span) * 100
            const shotI = shotIndexAt(shots, (startMs + endMs) / 2)
            const bg = shotI % 2 === 0 ? 'bg-sky-500/70' : 'bg-violet-500/70'
            return (
              <button
                key={w.i}
                type="button"
                className={`absolute top-1 h-6 truncate rounded px-0.5 text-[9px] text-white ${bg}`}
                style={{ left: `${left}%`, width: `${Math.max(wPct, 0.4)}%` }}
                onClick={() => onSeekOutput(remapSourceToOutput(startMs, edits))}
                title={wordDisplayText(w, edits.wordFixes)}
              >
                {captionByI.get(w.i)?.text ?? wordDisplayText(w, edits.wordFixes)}
              </button>
            )
          })}
        </div>
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-red-500"
          style={{ left: `${(outputMs / Math.max(outDur, 1)) * 100}%` }}
        />
        <TrimHandle
          label="In"
          ms={edits.trim.in}
          span={span}
          trimIn={edits.trim.in}
          onChange={(inMs) => onTrimChange({ in: inMs, out: edits.trim.out })}
        />
        <TrimHandle
          label="Out"
          ms={edits.trim.out}
          span={span}
          trimIn={edits.trim.in}
          onChange={(outMs) => onTrimChange({ in: edits.trim.in, out: outMs })}
        />
        <div className="absolute inset-x-0 top-[88px] h-5 overflow-hidden rounded bg-emerald-950/40">
          <AudioWaveformLane videoUrl={videoUrl} className="absolute inset-0 size-full text-emerald-400/90" />
          {audio?.music && (
            <div
              className="pointer-events-none absolute top-0.5 h-4 rounded bg-emerald-500/40 mix-blend-screen"
              style={{ left: 0, width: '100%' }}
              title="Music"
            />
          )}
          {(audio?.sfx || []).map((s) => {
            const left = (s.atMs / outSpan) * 100
            return (
              <div
                key={s.generationId}
                className="absolute top-0.5 h-4 w-1 rounded bg-amber-400"
                style={{ left: `${left}%` }}
                title={`SFX @ ${s.atMs}ms`}
              />
            )
          })}
        </div>
        <div className="absolute inset-x-0 bottom-0 h-6 rounded bg-muted/80">
          {broll.map((item) => {
            const left = (item.startMs / outSpan) * 100
            const wPct = ((item.endMs - item.startMs) / outSpan) * 100
            const color = item.source === 'ai' ? 'bg-sky-500/80' : 'bg-neutral-500/80'
            return (
              <BrollBar
                key={item.id}
                className={color}
                leftPct={left}
                widthPct={wPct}
                item={item}
                outSpan={outSpan}
                onChange={onBrollChange}
              />
            )
          })}
        </div>
        </div>
      </div>
    </div>
  )
}

function BrollBar({
  item,
  leftPct,
  widthPct,
  className,
  outSpan,
  onChange,
}: {
  item: BrollItem
  leftPct: number
  widthPct: number
  className: string
  outSpan: number
  onChange?: (id: string, patch: Partial<Pick<BrollItem, 'startMs' | 'endMs'>>) => void
}) {
  const drag = (mode: 'move' | 'start' | 'end', e: React.MouseEvent) => {
    if (!onChange) return
    e.preventDefault()
    const startX = e.clientX
    const start = { ...item }
    const parent = (e.target as HTMLElement).parentElement
    const onMove = (ev: MouseEvent) => {
      const w = parent?.clientWidth ?? 640
      const deltaMs = ((ev.clientX - startX) / w) * outSpan
      if (mode === 'move') {
        const len = start.endMs - start.startMs
        let s = Math.round(start.startMs + deltaMs)
        s = Math.max(0, Math.min(outSpan - len, s))
        onChange(item.id, { startMs: s, endMs: s + len })
      } else if (mode === 'start') {
        const s = Math.max(0, Math.min(start.endMs - BROLL_MIN_MS, Math.round(start.startMs + deltaMs)))
        onChange(item.id, { startMs: s })
      } else {
        const end = Math.max(start.startMs + BROLL_MIN_MS, Math.min(outSpan, Math.round(start.endMs + deltaMs)))
        onChange(item.id, { endMs: end })
      }
    }
    const onUp = () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  return (
    <div
      className={`absolute top-1 h-4 rounded ${className}`}
      style={{ left: `${leftPct}%`, width: `${Math.max(widthPct, 0.5)}%` }}
      onMouseDown={(e) => drag('move', e)}
    >
      <span className="absolute left-0 top-0 h-full w-1 cursor-ew-resize" onMouseDown={(e) => drag('start', e)} />
      <span className="absolute right-0 top-0 h-full w-1 cursor-ew-resize" onMouseDown={(e) => drag('end', e)} />
    </div>
  )
}

function remapSourceToOutput(sourceMs: number, edits: ClipEditsV2) {
  const segs = keepSegments(edits.trim.in, edits.trim.out, edits.cutRanges)
  let acc = 0
  for (const [a, b] of segs) {
    if (sourceMs >= a && sourceMs < b) return acc + (sourceMs - a)
    acc += b - a
  }
  return acc
}

function TrimHandle({
  label,
  ms,
  span,
  trimIn,
  onChange,
}: {
  label: string
  ms: number
  span: number
  trimIn: number
  onChange: (ms: number) => void
}) {
  return (
    <button
      type="button"
      className="absolute top-16 -translate-x-1/2 rounded border border-border bg-background px-1 text-[10px] shadow"
      style={{ left: `${((ms - trimIn) / span) * 100}%` }}
      onMouseDown={(e) => {
        e.preventDefault()
        const startX = e.clientX
        const startMs = ms
        const onMove = (ev: MouseEvent) => {
          const parent = (e.target as HTMLElement).parentElement
          const w = parent?.clientWidth ?? 640
          const delta = ((ev.clientX - startX) / w) * span
          onChange(Math.round(startMs + delta))
        }
        const onUp = () => {
          window.removeEventListener('mousemove', onMove)
          window.removeEventListener('mouseup', onUp)
        }
        window.addEventListener('mousemove', onMove)
        window.addEventListener('mouseup', onUp)
      }}
    >
      {label}
    </button>
  )
}
