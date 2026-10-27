import type { ClipProject } from '@prisma/client'

export type ClipProjectListItem = ClipProject & {
  clipCount: number
  thumbUrl: string | null
  durationMs: number
  ownerName?: string | null
  isPublished?: boolean
}
