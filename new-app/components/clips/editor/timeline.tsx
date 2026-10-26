'use client'

import type { ClipEditsV2 } from '@/lib/clips/edits'
import { keepSegments, outputDurationMs, wordDisplayText } from '@/lib/clips/edits'
import { buildCaptionWords } from '@/lib/clips/caption-words'
import type { SourceWord } from '@/lib/clips/source-words'
import { wordSourceMs } from '@/lib/clips/source-words'
import { shotIndexAt } from '@/lib/clips/crop-shots'
import type { CropShot } from '@/lib/server/clips/clip-detail'

export function Timeline({
  edits,
  words,
  shots,
  outputMs,
  onSeekOutput,
  onTrimChange,
}: {
  edits: ClipEditsV2
  words: SourceWord[]
  shots: CropShot[]
  outputMs: number
  onSeekOutput: (outputMs: number) => void
  onTrimChange: (trim: { in: number; out: number }) => void
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

  return (
    <div className="min-w-0 overflow-x-auto">
      <div className="relative h-24" style={{ width: widthPx }}>
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
      </div>
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
