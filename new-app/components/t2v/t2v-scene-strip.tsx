'use client'

import Image from 'next/image'
import type { T2vScene } from '@/lib/t2v/types'
import { estimateSceneMs } from '@/lib/t2v/estimate'
import { cn } from '@/lib/utils'

export function T2vSceneStrip({
  scenes,
  selectedId,
  onSelect,
  onReorder,
}: {
  scenes: T2vScene[]
  selectedId: string | null
  onSelect: (id: string) => void
  onReorder?: (from: number, to: number) => void
}) {
  return (
    <div className="flex h-[132px] shrink-0 items-center gap-2 overflow-x-auto border-t border-border bg-muted/20 px-3 py-2">
      {scenes.map((scene, i) => {
        const stale = scene.voice?.status === 'stale'
        return (
          <button
            key={scene.id}
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
              'relative shrink-0 overflow-hidden rounded-lg border text-left',
              selectedId === scene.id ? 'ring-2 ring-primary' : 'border-border',
            )}
            style={{ width: 168, height: 96 }}
            onClick={() => onSelect(scene.id)}
          >
            <div className="relative h-[72px] w-full bg-muted">
              {scene.media.thumbUrl ? (
                <Image src={scene.media.thumbUrl} alt="" fill className="object-cover" unoptimized />
              ) : null}
              {stale ? <span className="absolute right-1 top-1 size-2 rounded-full bg-amber-500" /> : null}
            </div>
            <p className="truncate px-2 py-1 text-[10px]">
              {i + 1} · {(estimateSceneMs(scene) / 1000).toFixed(1)}s
            </p>
          </button>
        )
      })}
    </div>
  )
}
