'use client'

import { formatScriptTimecode } from '@/lib/clips/script-editor/sync-playhead'

export function TimelineRuler({
  durationMs,
  pxPerMs,
  widthPx,
  onSeekOutput,
}: {
  durationMs: number
  pxPerMs: number
  widthPx: number
  onSeekOutput: (outMs: number) => void
}) {
  const span = Math.max(1, durationMs)
  const tickEveryMs = pxPerMs < 0.02 ? 10_000 : pxPerMs < 0.05 ? 5_000 : pxPerMs < 0.12 ? 2_000 : 1_000
  const ticks: number[] = []
  for (let t = 0; t <= span; t += tickEveryMs) ticks.push(t)

  return (
    <div
      className="relative h-6 shrink-0 cursor-pointer border-b border-border/60 bg-muted/40"
      style={{ width: widthPx }}
      onPointerDown={(e) => {
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
        const x = e.clientX - rect.left
        const outMs = Math.max(0, Math.min(span, x / pxPerMs))
        onSeekOutput(outMs)
      }}
    >
      {ticks.map((t) => {
        const left = t * pxPerMs
        return (
          <div key={t} className="absolute top-0 flex h-full flex-col" style={{ left }}>
            <span className="mt-0.5 pl-0.5 text-[9px] tabular-nums text-muted-foreground">{formatScriptTimecode(t)}</span>
            <div className="mt-auto h-2 w-px bg-border" />
          </div>
        )
      })}
    </div>
  )
}
