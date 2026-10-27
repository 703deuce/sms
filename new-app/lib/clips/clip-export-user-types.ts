import type { ExportDialogPreferences } from '@/lib/clips/export-preferences'
import { defaultExportDialogPreferences } from '@/lib/clips/export-preferences'

export type ClipExportUserPreferences = ExportDialogPreferences & {
  defaultAspect?: '9:16' | '4:5' | '1:1' | '16:9'
  defaultResolution?: '720p' | '1080p'
}

export type ClipUserStreamerChannelRow = {
  id: string
  platform: 'twitch' | 'kick'
  label: string | null
  url: string
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
  }
}
