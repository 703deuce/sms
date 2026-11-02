import type { ExportDialogPreferences } from '@/lib/clips/export-preferences'
import { defaultExportDialogPreferences } from '@/lib/clips/export-preferences'

export type VocabEntry = { from: string; to: string; /** Q4: phonetic respelling for TTS */ speakAs?: string }

export type ClipExportUserPreferences = ExportDialogPreferences & {
  defaultAspect?: '9:16' | '4:5' | '1:1' | '16:9'
  defaultResolution?: '720p' | '1080p'
  vocabulary?: VocabEntry[]
  vocabAutoApply?: boolean
}

export type ClipUserStreamerChannelRow = {
  id: string
  platform: 'twitch' | 'kick'
  label: string | null
  url: string
}

export function mergeVocabulary(raw: unknown): VocabEntry[] | undefined {
  if (!Array.isArray(raw)) return undefined
  const seen = new Set<string>()
  const out: VocabEntry[] = []
  for (const row of raw) {
    if (!row || typeof row !== 'object') continue
    const from = String((row as { from?: unknown }).from ?? '').trim()
    const to = String((row as { to?: unknown }).to ?? '').trim()
    const speakAs = String((row as { speakAs?: unknown }).speakAs ?? '').trim()
    if (from.length < 1 || from.length > 60 || to.length < 1 || to.length > 60) continue
    const key = from.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(speakAs ? { from, to, speakAs: speakAs.slice(0, 80) } : { from, to })
    if (out.length >= 200) break
  }
  return out.length ? out : undefined
}

export function mergeClipExportUserPrefs(raw: unknown): ClipExportUserPreferences {
  const base = defaultExportDialogPreferences()
  if (!raw || typeof raw !== 'object') return base
  const o = raw as Record<string, unknown>
  const aspect = o.defaultAspect
  const res = o.defaultResolution
  return {
    ...base,
    removeDeadAir: typeof o.removeDeadAir === 'boolean' ? o.removeDeadAir : base.removeDeadAir,
    alsoSrt: typeof o.alsoSrt === 'boolean' ? o.alsoSrt : base.alsoSrt,
    exportSfx: o.exportSfx === 'subtle' || o.exportSfx === 'meme' || o.exportSfx === 'off' ? o.exportSfx : base.exportSfx,
    headlineBarEnabled: typeof o.headlineBarEnabled === 'boolean' ? o.headlineBarEnabled : base.headlineBarEnabled,
    platformBadgeEnabled: typeof o.platformBadgeEnabled === 'boolean' ? o.platformBadgeEnabled : base.platformBadgeEnabled,
    channelLinkEnabled: typeof o.channelLinkEnabled === 'boolean' ? o.channelLinkEnabled : base.channelLinkEnabled,
    profanityCensor: typeof o.profanityCensor === 'boolean' ? o.profanityCensor : base.profanityCensor,
    defaultAspect:
      aspect === '9:16' || aspect === '4:5' || aspect === '1:1' || aspect === '16:9' ? aspect : undefined,
    defaultResolution: res === '720p' || res === '1080p' ? res : undefined,
    vocabulary: mergeVocabulary(o.vocabulary) ?? base.vocabulary,
    vocabAutoApply: typeof o.vocabAutoApply === 'boolean' ? o.vocabAutoApply : base.vocabAutoApply ?? true,
  }
}
