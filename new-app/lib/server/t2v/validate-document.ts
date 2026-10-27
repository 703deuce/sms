import 'server-only'
import { z } from 'zod'
import type { T2vDraftV1 } from '@/lib/t2v/types'

const sceneMediaSchema = z
  .object({
    provider: z.enum(['pexels', 'pixabay', 'upload', 'ai_image', 'ai_video', 'color']).optional(),
    kind: z.enum(['video', 'image', 'color']),
    assetId: z.string().optional(),
    providerId: z.string().optional(),
    storageKey: z.string().optional(),
    focalX: z.number().optional(),
    focalY: z.number().optional(),
    kenBurns: z.string().optional(),
    color: z.string().optional(),
    locked: z.boolean().optional(),
    query: z.string().optional(),
  })
  .passthrough()

const t2vDraftSchema = z.object({
  v: z.literal(1),
  title: z.string(),
  source: z.object({
    kind: z.enum(['prompt', 'script', 'url', 'blog', 'ppt', 'audio']),
    prompt: z.string().optional(),
    script: z.string().optional(),
    url: z.string().optional(),
    uploadId: z.string().optional(),
  }),
  settings: z.object({ aspect: z.enum(['16:9', '9:16', '1:1', '4:5']) }).passthrough(),
  voice: z.unknown().nullable(),
  music: z.unknown().nullable().optional(),
  scenes: z.array(z.object({ id: z.string() }).passthrough()),
  nextSlot: z.number(),
})

export function storageKeyAllowedForWorkspace(workspaceId: string, key: string): boolean {
  return key.startsWith(`ws/${workspaceId}/`) || key.startsWith('stock/')
}

function sanitizeSceneMedia(workspaceId: string, media: Record<string, unknown>): Record<string, unknown> {
  const next = { ...media }
  delete next.previewUrl
  delete next.srcUrl
  delete next.thumbUrl
  const sk = next.storageKey
  if (typeof sk === 'string' && sk && !storageKeyAllowedForWorkspace(workspaceId, sk)) {
    delete next.storageKey
  }
  return next
}

export function parseAndSanitizeT2vDraft(workspaceId: string, raw: unknown): T2vDraftV1 {
  const parsed = t2vDraftSchema.parse(raw) as T2vDraftV1
  const scenes = parsed.scenes.map((sc) => {
    const row = sc as T2vDraftV1['scenes'][number] & { media?: Record<string, unknown> }
    if (!row.media) return sc
    const media = sceneMediaSchema.parse(row.media)
    return { ...row, media: sanitizeSceneMedia(workspaceId, media as Record<string, unknown>) as typeof row.media }
  })
  return { ...parsed, scenes }
}
