import { z } from 'zod'
import type { ClipEditsV2 } from '@/lib/clips/edits'
import {
  EXPORT_PLATFORM_PRESETS,
  type ExportPlatformId,
} from '@/lib/clips/export-platform-presets'

export const EXPORT_HEADLINE_MAX_REGENERATIONS = 5

export const exportTemplateSchema = z.object({
  headlineBar: z
    .object({
      enabled: z.boolean().default(false),
      text: z.string().max(120).default(''),
    })
    .optional(),
  platformBadge: z.object({ enabled: z.boolean().default(false) }).optional(),
  channelLink: z
    .object({
      enabled: z.boolean().default(false),
      url: z.string().max(200).optional(),
    })
    .optional(),
  suggestedHeadline: z.string().max(120).optional(),
  headlineGenerations: z.number().int().min(0).max(EXPORT_HEADLINE_MAX_REGENERATIONS).optional(),
  platform: z.enum(['twitch', 'kick']).optional(),
  exportPlatformId: z.enum(['tiktok', 'youtube_shorts', 'instagram_reels']).optional(),
  profanityCensor: z.boolean().optional(),
})

export type ClipExportTemplate = z.infer<typeof exportTemplateSchema>

const SPLIT_LAYOUT_MODES = new Set([
  'split',
  'grid3',
  'grid4',
  'dynamic',
  'screen_pip',
  'split_debate',
  'grid',
  'two_up',
])

/** Headline bar only on single-view layouts (export-time rule). */
export function headlineBarAllowedForLayout(mode: ClipEditsV2['layout']['mode'] | string): boolean {
  const m = String(mode || 'speaker_follow')
  if (SPLIT_LAYOUT_MODES.has(m)) return false
  return true
}

export function normalizeExportTemplate(raw: unknown): ClipExportTemplate | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const parsed = exportTemplateSchema.safeParse(raw)
  return parsed.success ? parsed.data : undefined
}

export function exportTemplateOverlaysActive(tpl: ClipExportTemplate | undefined): boolean {
  if (!tpl) return false
  if (tpl.headlineBar?.enabled && (tpl.headlineBar.text || tpl.suggestedHeadline)) return true
  if (tpl.platformBadge?.enabled) return true
  if (tpl.channelLink?.enabled && tpl.channelLink.url) return true
  return false
}

export function cheapSuggestedHeadline(clip: {
  title: string
  aiMeta?: unknown
}): string {
  const meta = (clip.aiMeta && typeof clip.aiMeta === 'object' ? clip.aiMeta : {}) as Record<string, unknown>
  const post = meta.postCopy as { hookText?: string } | undefined
  if (post?.hookText?.trim()) return post.hookText.trim().slice(0, 120)
  if (typeof meta.hook === 'string' && meta.hook.trim()) return meta.hook.trim().slice(0, 120)
  return clip.title.trim().slice(0, 120)
}

const TWITCH = /^https?:\/\/(www\.)?twitch\.tv\/[a-zA-Z0-9_]{2,25}\/?$/i
const KICK = /^https?:\/\/(www\.)?kick\.com\/[a-zA-Z0-9_]{2,25}\/?$/i

export function normalizeChannelUrl(input: string): string | null {
  const t = input.trim()
  if (!t) return null
  const withProto = t.startsWith('http') ? t : `https://${t}`
  try {
    const u = new URL(withProto)
    const host = u.hostname.replace(/^www\./, '').toLowerCase()
    if (host === 'twitch.tv') {
      const slug = u.pathname.split('/').filter(Boolean)[0]
      if (!slug) return null
      const url = `https://twitch.tv/${slug}`
      return TWITCH.test(url) ? url : null
    }
    if (host === 'kick.com') {
      const slug = u.pathname.split('/').filter(Boolean)[0]
      if (!slug) return null
      const url = `https://kick.com/${slug}`
      return KICK.test(url) ? url : null
    }
  } catch {
    return null
  }
  return null
}

export function channelUrlFromVodUrl(vodUrl: string): string | null {
  try {
    const u = new URL(vodUrl.startsWith('http') ? vodUrl : `https://${vodUrl}`)
    const host = u.hostname.replace(/^www\./, '').toLowerCase()
    const parts = u.pathname.split('/').filter(Boolean)
    if (host === 'twitch.tv' && parts[0] && !['videos', 'directory'].includes(parts[0])) {
      return normalizeChannelUrl(`https://twitch.tv/${parts[0]}`)
    }
    if (host === 'kick.com' && parts[0]) {
      return normalizeChannelUrl(`https://kick.com/${parts[0]}`)
    }
  } catch {
    return null
  }
  return null
}

export function effectiveHeadlineText(tpl: ClipExportTemplate | undefined): string {
  if (!tpl?.headlineBar?.enabled) return ''
  const t = tpl.headlineBar.text?.trim()
  if (t) return t
  return (tpl.suggestedHeadline || '').trim()
}

const HEADLINE_CHAR_LIMIT = 40

/** Stream export headline: ALL CAPS, ~40 chars, 1–2 trailing emoji preserved. */
export function formatHeadlineForExport(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed) return ''
  const emojiTail = (trimmed.match(/(\p{Extended_Pictographic}+)$/u) || [])[0] || ''
  const body = trimmed.slice(0, trimmed.length - emojiTail.length).trim()
  const capped = body.slice(0, HEADLINE_CHAR_LIMIT)
  const upper = capped.toLocaleUpperCase('en-US')
  const emojis = [...emojiTail].slice(0, 2).join('')
  return `${upper}${emojis ? ` ${emojis}` : ''}`.trim()
}

export function headlineTextMinY(
  platformId: ExportPlatformId | undefined,
  playH = 1920,
): number {
  const id = platformId || 'tiktok'
  const ref = EXPORT_PLATFORM_PRESETS[id].headlineTextMinYPx
  return Math.round(ref * (playH / 1920))
}

export function headlineBarLayout(
  platformId: ExportPlatformId | undefined,
  playH = 1920,
): { barHeightPx: number; textTopPx: number } {
  const textMin = headlineTextMinY(platformId, playH)
  const barHeightPx = Math.max(Math.round(420 * (playH / 1920)), textMin + Math.round(56 * (playH / 1920)))
  const textTopPx = Math.max(textMin, Math.round(barHeightPx * 0.58) - Math.round(8 * (playH / 1920)))
  return { barHeightPx, textTopPx }
}
