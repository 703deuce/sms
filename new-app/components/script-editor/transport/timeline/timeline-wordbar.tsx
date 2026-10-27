'use client'

import { cn } from '@/lib/utils'
import type { WordbarItem } from '@/lib/clips/script-editor/timeline-model'

export function TimelineWordbar({
  items,
  gapChips,
  pxPerMs,
  widthPx,
  selectedWordIds,
  onSelectWord,
  onPadDragEnd,
}: {
  items: WordbarItem[]
  gapChips: { outStartMs: number; outEndMs: number; label: string }[]
  pxPerMs: number
  widthPx: number
  selectedWordIds: Set<string>
  onSelectWord: (wordId: string) => void
  onPadDragEnd?: (wordId: string, padMs: number) => void
}) {
  return (
    <div className="relative h-6 shrink-0 border-b border-border/40 bg-muted/20" style={{ width: widthPx }}>
      {gapChips.map((g) => (
        <div
          key={`gap-${g.outStartMs}`}
          className="absolute top-1 flex h-4 items-center justify-center rounded bg-amber-500/30 px-0.5 text-[8px] text-amber-950 dark:text-amber-100"
          style={{
            left: g.outStartMs * pxPerMs,
            width: Math.max(4, (g.outEndMs - g.outStartMs) * pxPerMs),
          }}
          title="Gap"
        >
          {g.label}
        </div>
      ))}
      {items.map((item) => {
        const left = item.outStartMs * pxPerMs
        const w = Math.max(2, (item.outEndMs - item.outStartMs) * pxPerMs)
        const selected =
          item.kind === 'word'
            ? selectedWordIds.has(item.wordId)
            : item.wordIds.some((id) => selectedWordIds.has(id))
        return (
          <button
            key={`${item.kind}-${item.outStartMs}`}
            type="button"
            className={cn(
              'absolute top-1 h-4 truncate rounded px-0.5 text-[9px]',
              item.kind === 'group' ? 'bg-muted-foreground/25' : 'bg-sky-500/70 text-white',
              selected && 'ring-2 ring-primary',
            )}
            style={{ left, width: w }}
            onClick={() => {
              if (item.kind === 'word') onSelectWord(item.wordId)
              else if (item.wordIds[0]) onSelectWord(item.wordIds[0])
            }}
            title={item.kind === 'word' ? item.text : `${item.wordIds.length} words`}
          >
            {item.kind === 'word' ? item.text : item.label}
          </button>
        )
      })}
      {items
        .filter((i): i is WordbarItem & { kind: 'word' } => i.kind === 'word')
        .map((item) =>
          onPadDragEnd ? (
            <div
              key={`pad-${item.wordId}`}
              className="absolute top-0 h-full w-1 cursor-ew-resize hover:bg-primary/40"
              style={{ left: item.outStartMs * pxPerMs - 2 }}
              onPointerDown={(e) => {
                if (!e.metaKey && !e.ctrlKey) return
                e.preventDefault()
                const startX = e.clientX
                const startOut = item.outStartMs
                let latestPad = Math.max(0, Math.round(startOut))
                const onMove = (ev: PointerEvent) => {
                  const deltaMs = (ev.clientX - startX) / pxPerMs
                  latestPad = Math.max(0, Math.round(startOut + deltaMs))
                }
                const onUp = () => {
                  window.removeEventListener('pointermove', onMove)
                  window.removeEventListener('pointerup', onUp)
                  onPadDragEnd(item.wordId, latestPad)
                }
                window.addEventListener('pointermove', onMove)
                window.addEventListener('pointerup', onUp)
              }}
            />
          ) : null,
        )}
    </div>
  )
}
