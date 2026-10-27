import type { ScriptEditorSettings } from '@/lib/clips/script-edl/types'

export function defaultScriptEditorSettings(): ScriptEditorSettings {
  return {
    aspect: '9:16',
    reframeMode: 'speaker_follow',
    captionsEnabled: true,
    showDeletedWords: true,
    volumePct: 100,
    captions: {
      enabled: true,
      presetId: 'bold_pop',
      animation: 'pop',
      size: 6.5,
      position: 'bottom',
      case: 'sentence',
      wordsPerLine: 2,
    },
  }
}

export function resolveScriptSettings(
  raw?: ScriptEditorSettings | null,
  prefs?: {
    defaultClipAspect?: '9:16' | '1:1' | '4:5' | '16:9'
    defaultCaptionStyleId?: string
  } | null,
): ScriptEditorSettings {
  const base = defaultScriptEditorSettings()
  const baseCaptions = base.captions ?? { enabled: true, presetId: 'bold_pop' }
  const withPrefs = prefs
    ? {
        ...base,
        aspect: prefs.defaultClipAspect ?? base.aspect,
        captions: {
          ...baseCaptions,
          presetId: prefs.defaultCaptionStyleId ?? baseCaptions.presetId,
        },
      }
    : base
  if (!raw) return withPrefs
  const mergedCaptions = { ...(withPrefs.captions ?? baseCaptions), ...(raw.captions ?? {}) }
  return {
    ...withPrefs,
    ...raw,
    captions: mergedCaptions,
  }
}
