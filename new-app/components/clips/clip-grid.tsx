'use client'

import { ClipCard } from './clip-card'
import { UnifiedClipTypeBadge } from './unified-clip-type-badge'
import type { ExportAspect } from '../../lib/clips/export-aspect'
import type { UnifiedClipKind } from '../../lib/clips/unified-clip-results'

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
  spokenFirstLine?: string
  resultKind?: UnifiedClipKind
}

export function ClipGrid({
  clips,
  projectId,
  onDownload,
  onHidden,
  onChanged,
  isStreamer = false,
  cardAspect = '9:16' as ExportAspect,
  selectedIds,
  onToggleSelect,
  projectHasUpload = false,
}: {
  clips: ClipCardData[]
  projectId: string
  onDownload?: (clipId: string) => void | Promise<void>
  onHidden?: (clipId: string) => void
  onChanged?: () => void
  isStreamer?: boolean
  cardAspect?: ExportAspect
  selectedIds?: Set<string>
  onToggleSelect?: (clipId: string) => void
  projectHasUpload?: boolean
}) {
  return (
    <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {clips.map((c) => (
        <div key={c.id} className="relative min-w-0">
          {c.resultKind ? (
            <div className="pointer-events-none absolute left-12 top-2 z-20">
              <UnifiedClipTypeBadge kind={c.resultKind} />
            </div>
          ) : null}
          <ClipCard
            clip={c}
            projectId={projectId}
            onDownload={onDownload}
            onHidden={onHidden}
            onChanged={onChanged}
            isStreamer={isStreamer}
            cardAspect={cardAspect}
            selected={selectedIds?.has(c.id) ?? false}
            onToggleSelect={onToggleSelect ? () => onToggleSelect(c.id) : undefined}
            projectHasUpload={projectHasUpload}
          />
        </div>
      ))}
    </div>
  )
}
