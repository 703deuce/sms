'use client'

import { ClipCard } from '@/components/clips/clip-card'
import type { ExportAspect } from '@/lib/clips/export-aspect'

export type ClipCardData = {
  id: string
  title: string
  score: number
  scores: unknown
  durationMs: number
  startMs: number
  endMs: number
  previewUrl: string | null
  posterUrl: string | null
  reason?: string | null
  aiMeta?: unknown
  edits?: unknown
}

export function ClipGrid({
  clips,
  projectId,
  onDownload,
  onHidden,
  isStreamer = false,
  cardAspect = '9:16' as ExportAspect,
  selectedIds,
  onToggleSelect,
}: {
  clips: ClipCardData[]
  projectId: string
  onDownload?: (clipId: string) => void | Promise<void>
  onHidden?: (clipId: string) => void
  isStreamer?: boolean
  cardAspect?: ExportAspect
  selectedIds?: Set<string>
  onToggleSelect?: (clipId: string) => void
}) {
  return (
    <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {clips.map((c) => (
        <ClipCard
          key={c.id}
          clip={c}
          projectId={projectId}
          onDownload={onDownload}
          onHidden={onHidden}
          isStreamer={isStreamer}
          cardAspect={cardAspect}
          selected={selectedIds?.has(c.id) ?? false}
          onToggleSelect={onToggleSelect ? () => onToggleSelect(c.id) : undefined}
        />
      ))}
    </div>
  )
}
