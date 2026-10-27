'use client'

/** M4 will wire caption layers; M3 shows a labeled stub lane aligned to the ruler. */
export function TimelineCaptionsLane({ widthPx }: { widthPx: number }) {
  return (
    <div className="relative h-6 shrink-0 border-b border-border/40 bg-card/20" style={{ width: widthPx }}>
      <div className="absolute inset-y-1 left-1 right-1 rounded bg-violet-500/15 ring-1 ring-violet-500/25" title="Captions (M4)">
        <span className="px-1 text-[9px] font-medium text-violet-700/80 dark:text-violet-200/80">Captions</span>
      </div>
    </div>
  )
}
