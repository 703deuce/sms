/** Remembered export dialog defaults (browser only). */
import type { ExportSfxMode } from '@/lib/clips/export-sfx'
import type { ClipExportTemplate } from '@/lib/clips/export-template'

const STORAGE_KEY = 'clips.exportDialog.v1'

export type ExportDialogPreferences = {
  removeDeadAir: boolean
  alsoSrt: boolean
  exportSfx: ExportSfxMode
  headlineBarEnabled: boolean
  platformBadgeEnabled: boolean
  channelLinkEnabled: boolean
  profanityCensor: boolean
  defaultAspect?: '9:16' | '4:5' | '1:1' | '16:9'
  defaultResolution?: '720p' | '1080p'
}

const DEFAULTS: ExportDialogPreferences = {
  removeDeadAir: false,
  alsoSrt: false,
  exportSfx: 'off',
  headlineBarEnabled: false,
  platformBadgeEnabled: false,
  channelLinkEnabled: false,
  profanityCensor: false,
}

export function defaultExportDialogPreferences(): ExportDialogPreferences {
  return { ...DEFAULTS }
}

export function loadExportDialogPreferences(): ExportDialogPreferences {
  if (typeof window === 'undefined') return defaultExportDialogPreferences()
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return defaultExportDialogPreferences()
    const parsed = JSON.parse(raw) as Partial<ExportDialogPreferences>
    return { ...DEFAULTS, ...parsed }
  } catch {
    return defaultExportDialogPreferences()
  }
}

export function saveExportDialogPreferences(patch: Partial<ExportDialogPreferences>): void {
  if (typeof window === 'undefined') return
  const next = { ...loadExportDialogPreferences(), ...patch }
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    /* quota / private mode */
  }
}

/** Apply remembered toggles to a stream headline template (does not overwrite headline text). */
export function applyExportPreferencesToTemplate(
  tpl: ClipExportTemplate,
  prefs: ExportDialogPreferences,
): ClipExportTemplate {
  const text = tpl.headlineBar?.text ?? tpl.suggestedHeadline ?? ''
  return {
    ...tpl,
    headlineBar: { enabled: prefs.headlineBarEnabled, text },
    platformBadge: { enabled: prefs.platformBadgeEnabled },
    channelLink: {
      enabled: prefs.channelLinkEnabled,
      url: tpl.channelLink?.url ?? '',
    },
    profanityCensor: prefs.profanityCensor,
  }
}
