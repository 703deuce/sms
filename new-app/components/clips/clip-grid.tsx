'use client'

import { ClipCard } from '@/components/clips/clip-card'

export type ClipCardData = {
  id: string
  title: string
  score: number
  scores: unknown
  durationMs: number
  previewUrl: string | null
  posterUrl: string | null
  reason?: string | null
}

export function ClipGrid({
  clips,
  onDownload,
}: {
  clips: ClipCardData[]
  onDownload: (clipId: string) => void
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {clips.map((c) => (
        <ClipCard key={c.id} clip={c} onDownload={onDownload} />
      ))}
    </div>
  )
}
