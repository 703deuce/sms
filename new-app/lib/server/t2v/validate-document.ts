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

function hostnamesFromEnvUrls(): Set<string> {
  const hosts = new Set<string>()
  const candidates = [
    process.env.SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.S3_PUBLIC_ENDPOINT,
    process.env.S3_ENDPOINT,
    process.env.APP_URL,
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL.trim()}` : undefined,
  ]
  for (const raw of candidates) {
    const s = raw?.trim()
    if (!s) continue
    try {
      const href = s.includes('://') ? s : `https://${s}`
      hosts.add(new URL(href).hostname.toLowerCase())
    } catch {
      /* ignore */
    }
  }
  return hosts
}

const OWNED_STORAGE_HOSTS = hostnamesFromEnvUrls()

export function storageKeyAllowedForWorkspace(workspaceId: string, key: string): boolean {
  return key.startsWith(`ws/${workspaceId}/`) || key.startsWith('stock/')
}

function hostMatchesAllowlist(host: string): boolean {
  const h = host.toLowerCase()
  if ([...ALLOWED_THUMB_HOSTS].some((allowed) => h === allowed || h.endsWith(`.${allowed}`))) return true
  if (h === 'backblazeb2.com' || h.endsWith('.backblazeb2.com')) return true
  if ([...OWNED_STORAGE_HOSTS].some((owned) => h === owned || h.endsWith(`.${owned}`))) return true
  if (h.endsWith('.supabase.co')) return true
  return false
}

function thumbUrlAllowed(url: string): boolean {
  try {
    const parsed = new URL(url)
    if (!hostMatchesAllowlist(parsed.hostname)) return false
    if (parsed.pathname.includes('/storage/v1/object/')) return true
    return true
  } catch {
    return false
  }
}

const attributionSchema = z.object({
  author: z.string(),
  pageUrl: z.string().url(),
  provider: z.enum(['pexels', 'pixabay']),
})

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
  attribution: attributionSchema.optional(),
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

/** Drop invalid media fields one at a time; never return the raw unvalidated object. */
function stripSceneMedia(media: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...media }
  delete out.srcUrl
  for (let guard = 0; guard < 32; guard++) {
    const parsed = sceneMediaSchema.safeParse(out)
    if (parsed.success) return { ...parsed.data }
    const issue = parsed.error.issues[0]
    const key = issue?.path[0]
    if (typeof key !== 'string' || !(key in out)) break
    delete out[key]
  }
  const kind = out.kind === 'video' || out.kind === 'image' || out.kind === 'color' ? out.kind : 'color'
  return { kind }
}

function sanitizeSceneMedia(workspaceId: string, media: Record<string, unknown>): Record<string, unknown> {
  const next = stripSceneMedia(media)
  const thumb = next.thumbUrl
  if (typeof thumb === 'string' && thumb && !thumbUrlAllowed(thumb)) delete next.thumbUrl
  const preview = next.previewUrl
  if (typeof preview === 'string' && preview && !thumbUrlAllowed(preview)) delete next.previewUrl
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
