'use client'

import type { TimelineMusicClip } from '@/lib/clips/script-editor/timeline-lanes'

export function TimelineMusicLane({
  widthPx,
  pxPerMs,
  clips,
}: {
  widthPx: number
  pxPerMs: number
  clips: TimelineMusicClip[]
}) {
  return (
    <div className="relative min-h-[24px] shrink-0 border-t border-border/40 bg-emerald-950/15" style={{ width: widthPx }}>
      {clips.length === 0 ? (
        <div className="absolute inset-y-1 left-1 right-1 flex items-center rounded border border-dashed border-emerald-500/30 px-1">
          <span className="text-[9px] text-emerald-800/80 dark:text-emerald-200/80">Music (M10)</span>
        </div>
      ) : (
        clips.map((c) => (
          <div
            key={c.id}
            className="absolute top-1 h-4 truncate rounded bg-emerald-500/70 px-0.5 text-[8px] text-white"
            style={{
              left: c.outStartMs * pxPerMs,
              width: Math.max(8, (c.outEndMs - c.outStartMs) * pxPerMs),
            }}
            title={c.label}
          >
            {c.label}
          </div>
        ))
      )}
    </div>
  )
}
