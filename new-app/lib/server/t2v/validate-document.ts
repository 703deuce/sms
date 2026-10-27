import 'server-only'
import { z } from 'zod'
import type { T2vDraftV1 } from '@/lib/t2v/types'
import { resolveT2vBrandSettings } from '@/lib/server/t2v/brand-settings'

const ALLOWED_THUMB_HOSTS = new Set([
  'images.pexels.com',
  'videos.pexels.com',
  'cdn.pixabay.com',
  'pixabay.com',
  'images.unsplash.com',
])

export function storageKeyAllowedForWorkspace(workspaceId: string, key: string): boolean {
  return key.startsWith(`ws/${workspaceId}/`) || key.startsWith('stock/')
}

function thumbUrlAllowed(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase()
    return [...ALLOWED_THUMB_HOSTS].some((h) => host === h || host.endsWith(`.${h}`))
  } catch {
    return false
  }
}

const sceneMediaSchema = z.object({
  provider: z.enum(['pexels', 'pixabay', 'upload', 'ai_image', 'ai_video', 'color']).optional(),
  kind: z.enum(['video', 'image', 'color']),
  assetId: z.string().optional(),
  providerId: z.string().optional(),
  storageKey: z.string().optional(),
  srcInMs: z.number().finite().min(0).optional(),
  durationMs: z.number().finite().min(0).optional(),
  width: z.number().finite().min(1).optional(),
  height: z.number().finite().min(1).optional(),
  attribution: z.string().max(500).optional(),
  focalX: z.number().optional(),
  focalY: z.number().optional(),
  kenBurns: z.string().optional(),
  color: z.string().optional(),
  locked: z.boolean().optional(),
  query: z.string().optional(),
  thumbUrl: z.string().url().optional(),
  previewUrl: z.string().url().optional(),
})

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
  settings: z
    .object({
      aspect: z.enum(['16:9', '9:16', '1:1', '4:5']),
      brandTemplateId: z.string().optional(),
      brand: z.record(z.unknown()).optional(),
    })
    .passthrough(),
  voice: z.unknown().nullable(),
  music: z.unknown().nullable().optional(),
  scenes: z.array(z.object({ id: z.string() }).passthrough()),
  nextSlot: z.number(),
})

function sanitizeSceneMedia(workspaceId: string, media: Record<string, unknown>): Record<string, unknown> {
  const parsed = sceneMediaSchema.safeParse(media)
  const next = { ...(parsed.success ? parsed.data : media) } as Record<string, unknown>
  delete next.srcUrl
  const keepRemoteThumb =
    next.provider === 'upload' || next.provider === 'ai_image' || next.provider === 'ai_video'
  const thumb = next.thumbUrl
  if (typeof thumb === 'string' && thumb) {
    if (!keepRemoteThumb && !thumbUrlAllowed(thumb)) delete next.thumbUrl
  }
  const preview = next.previewUrl
  if (typeof preview === 'string' && preview) {
    if (!keepRemoteThumb && !thumbUrlAllowed(preview)) delete next.previewUrl
  }
  const sk = next.storageKey
  if (typeof sk === 'string' && sk && !storageKeyAllowedForWorkspace(workspaceId, sk)) {
    delete next.storageKey
  }
  return next
}

export async function parseAndSanitizeT2vDraft(workspaceId: string, raw: unknown): Promise<T2vDraftV1> {
  const parsed = t2vDraftSchema.parse(raw) as T2vDraftV1
  const settings = await resolveT2vBrandSettings(workspaceId, parsed.settings)
  const scenes = parsed.scenes.map((sc) => {
    const row = sc as T2vDraftV1['scenes'][number] & { media?: Record<string, unknown> }
    if (!row.media) return sc
    return { ...row, media: sanitizeSceneMedia(workspaceId, row.media) as typeof row.media }
  })
  return { ...parsed, settings, scenes }
}
