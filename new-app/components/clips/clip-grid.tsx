'use client'

import { ClipCard } from '@/components/clips/clip-card'

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
}

export function ClipGrid({
  clips,
  projectId,
  onDownload,
  onHidden,
  isStreamer = false,
}: {
  clips: ClipCardData[]
  projectId: string
  onDownload: (clipId: string) => void
  onHidden?: (clipId: string) => void
  isStreamer?: boolean
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {clips.map((c) => (
        <ClipCard
          key={c.id}
          clip={c}
          projectId={projectId}
          onDownload={onDownload}
          onHidden={onHidden}
          isStreamer={isStreamer}
        />
      ))}
    </div>
  )
}
