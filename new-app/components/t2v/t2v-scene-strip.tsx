'use client'

import Image from 'next/image'
import type { T2vScene } from '@/lib/t2v/types'
import { estimateSceneMs } from '@/lib/t2v/estimate'
import { cn } from '@/lib/utils'

const TRANSITION_LABEL: Record<string, string> = {
  cut: '✂',
  fade: '◐',
  dissolve: '◎',
  fade_black: '▮',
  fade_white: '▯',
  slide_left: '←',
  slide_right: '→',
  slide_up: '↑',
  wipe_left: '⟵',
  circle_open: '○',
  zoom_in: '+',
  smooth_left: '⇠',
}

export function T2vSceneStrip({
  scenes,
  selectedId,
  onSelect,
  onReorder,
  onAddScene,
}: {
  scenes: T2vScene[]
  selectedId: string | null
  onSelect: (id: string) => void
  onReorder?: (from: number, to: number) => void
  onAddScene?: () => void
}) {
  return (
    <div className="flex h-[132px] shrink-0 items-center gap-1 overflow-x-auto border-t border-border bg-muted/20 px-3 py-2 max-lg:h-24">
      {onAddScene ? (
        <button
          type="button"
          className="flex size-12 shrink-0 items-center justify-center rounded-lg border border-dashed border-border text-lg text-muted-foreground hover:bg-muted"
          onClick={onAddScene}
          aria-label="Add scene"
        >
          +
        </button>
      ) : null}
      {scenes.map((scene, i) => {
        const stale = scene.voice?.status === 'stale'
        const chip = TRANSITION_LABEL[scene.transition] ?? '·'
        return (
          <div key={scene.id} className="flex shrink-0 items-center gap-1">
            {i > 0 ? (
              <span
                className="flex size-6 shrink-0 items-center justify-center rounded-full border border-border bg-background text-[10px] text-muted-foreground"
                title={scenes[i - 1]?.transition ?? 'transition'}
              >
                {TRANSITION_LABEL[scenes[i - 1]?.transition ?? 'cut'] ?? chip}
              </span>
            ) : null}
            <button
              type="button"
              draggable={Boolean(onReorder)}
              onDragStart={(e) => e.dataTransfer.setData('text/plain', String(i))}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault()
                const from = Number(e.dataTransfer.getData('text/plain'))
                if (!Number.isNaN(from) && from !== i) onReorder?.(from, i)
              }}
              className={cn(
                'relative shrink-0 overflow-hidden rounded-lg border text-left max-lg:w-[152px] max-lg:h-[86px]',
                selectedId === scene.id ? 'ring-2 ring-primary' : 'border-border',
              )}
              style={{ width: 168, height: 96 }}
              onClick={() => onSelect(scene.id)}
            >
              <div className="relative h-[72px] w-full bg-muted max-lg:h-[60px]">
                {scene.media.thumbUrl ? (
                  <Image src={scene.media.thumbUrl} alt="" fill className="object-cover" unoptimized />
                ) : null}
                {stale ? <span className="absolute right-1 top-1 size-2 rounded-full bg-amber-500" /> : null}
              </div>
              <p className="truncate px-2 py-1 text-[10px]">
                {i + 1} · {(estimateSceneMs(scene) / 1000).toFixed(1)}s
              </p>
            </button>
          </div>
        )
      })}
    </div>
  )
}
