'use client'

import type { TimelineOverlayClip } from '@/lib/clips/script-editor/timeline-lanes'

export function TimelineOverlayLane({
  widthPx,
  pxPerMs,
  clips,
  layerIndex,
}: {
  widthPx: number
  pxPerMs: number
  clips: TimelineOverlayClip[]
  layerIndex: number
}) {
  const layerClips = clips.filter((c) => c.layer === layerIndex)
  return (
    <div className="relative h-6 shrink-0 border-b border-border/40 bg-sky-950/10" style={{ width: widthPx }}>
      {layerClips.length === 0 && layerIndex === 0 ? (
        <div className="absolute inset-y-1 left-1 right-1 flex items-center rounded border border-dashed border-sky-500/25 px-1">
          <span className="text-[9px] text-sky-800/70 dark:text-sky-200/70">Overlays / B-roll (M9)</span>
        </div>
      ) : null}
      {layerClips.map((c) => (
        <div
          key={c.id}
          className="absolute top-1 h-4 truncate rounded bg-sky-500/75 px-0.5 text-[8px] text-white"
          style={{
            left: c.outStartMs * pxPerMs,
            width: Math.max(6, (c.outEndMs - c.outStartMs) * pxPerMs),
          }}
          title={c.label}
        >
          {c.label}
        </div>
      ))}
    </div>
  )
}
