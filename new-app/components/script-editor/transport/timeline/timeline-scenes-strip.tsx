'use client'

import type { TimelineSceneMarker } from '@/lib/clips/script-editor/timeline-lanes'

export function TimelineScenesStrip({
  widthPx,
  pxPerMs,
  scenes,
  onSeekOutput,
}: {
  widthPx: number
  pxPerMs: number
  scenes: TimelineSceneMarker[]
  onSeekOutput?: (outMs: number) => void
}) {
  return (
    <div className="relative h-7 shrink-0 border-b border-border/40 bg-card/15" style={{ width: widthPx }}>
      {scenes.length === 0 ? (
        <div className="absolute inset-y-1 left-1 right-1 flex items-center rounded border border-dashed border-border/50 px-1">
          <span className="text-[9px] text-muted-foreground">Scenes (M7)</span>
        </div>
      ) : (
        scenes.map((s) => (
          <button
            key={s.sceneId}
            type="button"
            className="absolute top-1 flex h-5 min-w-[28px] items-center justify-center rounded bg-neutral-600/40 px-1 text-[9px] text-white"
            style={{ left: s.outStartMs * pxPerMs }}
            onClick={() => onSeekOutput?.(s.outStartMs)}
            title={s.label}
          >
            {s.label.replace(/^Scene /, '#')}
          </button>
        ))
      )}
    </div>
  )
}
