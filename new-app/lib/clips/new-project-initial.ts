import { defaultClipSettings, TOOL_PRESET_MAP, type ClipProjectSettings } from '@/lib/clips/settings'

/**
 * FIX2 R1: initial settings for the New project page. New projects default to "Auto variety"
 * (layout 'auto'). A tool preset that names its own layout still wins. Full-video intent is unchanged.
 */
export function initialNewProjectSettings(preset: string | null | undefined, fullIntent: boolean): ClipProjectSettings {
  if (fullIntent) return defaultClipSettings({ byo: true, fullVideo: true, aspectRatio: '16:9' })
  const p = preset ? TOOL_PRESET_MAP[preset] : undefined
  if (p) return defaultClipSettings({ layout: 'auto', ...p })
  return defaultClipSettings({ layout: 'auto' })
}
