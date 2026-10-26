'use client'

import type { ClipEditsV2, ClipWord } from '@/lib/clips/edits'

export function Timeline({
  durationMs,
  edits,
  words,
  currentMs,
  onSeek,
  onTrimChange,
}: {
  durationMs: number
  edits: ClipEditsV2
  words: ClipWord[]
  currentMs: number
  onSeek: (ms: number) => void
  onTrimChange: (trim: { in: number; out: number }) => void
}) {
  const maxMs = durationMs + 5000
  const width = Math.max(durationMs, maxMs)

  return (
    <div className="w-full overflow-x-auto rounded-lg border border-border bg-muted/30 p-3">
      <div className="relative h-24 min-w-[640px]" style={{ width: `${Math.max(640, width / 10)}px` }}>
        <div className="absolute inset-x-0 top-8 h-8 rounded bg-muted">
          {words.map((w, i) => {
            const left = (w.s * 1000 / width) * 100
            const wPct = ((w.e - w.s) * 1000 / width) * 100
            const spk = w.spk ?? 0
            const bg = spk % 2 === 0 ? 'bg-sky-500/70' : 'bg-violet-500/70'
            return (
              <button
                key={`${w.s}-${i}`}
                type="button"
                className={`absolute top-1 h-6 truncate rounded px-0.5 text-[9px] text-white ${bg}`}
                style={{ left: `${left}%`, width: `${Math.max(wPct, 0.5)}%` }}
                onClick={() => onSeek(w.s * 1000)}
                title={w.w}
              >
                {w.w}
              </button>
            )
          })}
        </div>
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-red-500"
          style={{ left: `${(currentMs / width) * 100}%` }}
        />
        <TrimHandle
          label="In"
          ms={edits.trim.in}
          width={width}
          onChange={(inMs) => onTrimChange({ in: inMs, out: edits.trim.out })}
        />
        <TrimHandle
          label="Out"
          ms={edits.trim.out}
          width={width}
          onChange={(outMs) => onTrimChange({ in: edits.trim.in, out: outMs })}
        />
      </div>
    </div>
  )
}

function TrimHandle({
  label,
  ms,
  width,
  onChange,
}: {
  label: string
  ms: number
  width: number
  onChange: (ms: number) => void
}) {
  return (
    <button
      type="button"
      className="absolute top-16 -translate-x-1/2 rounded border border-border bg-background px-1 text-[10px] shadow"
      style={{ left: `${(ms / width) * 100}%` }}
      onMouseDown={(e) => {
        e.preventDefault()
        const startX = e.clientX
        const startMs = ms
        const onMove = (ev: MouseEvent) => {
          const delta = ((ev.clientX - startX) / 640) * width
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
