import type { ClipProjectListRow } from '@/lib/server/clips/projects'

export type ClipProjectListItem = ClipProjectListRow & {
  clipCount: number
  thumbUrl: string | null
  durationMs: number
  ownerName?: string | null
  isPublished?: boolean
  publishedAt?: string | null
  t2vDraftStatus?: string | null
  t2vDraftProgress?: number | null
  t2vSceneCount?: number | null
}
