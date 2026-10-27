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
      size: 1,
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
  const withPrefs = prefs
    ? {
        ...base,
        aspect: prefs.defaultClipAspect ?? base.aspect,
        captions: {
          ...base.captions,
          presetId: prefs.defaultCaptionStyleId ?? base.captions.presetId,
        },
      }
    : base
  if (!raw) return withPrefs
  return {
    ...withPrefs,
    ...raw,
    captions: { ...withPrefs.captions, ...raw.captions },
  }
}
