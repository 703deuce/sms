import type { ExportPlatformId } from '@/lib/clips/export-platform-presets'

export const PLATFORM_HASHTAG_LIMITS: Record<
  ExportPlatformId,
  { min: number; max: number; label: string }
> = {
  instagram_reels: { min: 0, max: 5, label: 'Instagram Reels' },
  tiktok: { min: 3, max: 5, label: 'TikTok' },
  youtube_shorts: { min: 0, max: 3, label: 'YouTube Shorts' },
}

export function clampHashtagsForPlatform(platform: ExportPlatformId, tags: string[]): string[] {
  const clean = tags
    .map((h) => h.replace(/^#/, '').trim())
    .filter(Boolean)
  const { max } = PLATFORM_HASHTAG_LIMITS[platform]
  return clean.slice(0, max)
}
