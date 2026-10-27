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

export function resolveScriptSettings(raw?: ScriptEditorSettings | null): ScriptEditorSettings {
  const base = defaultScriptEditorSettings()
  if (!raw) return base
  return {
    ...base,
    ...raw,
    captions: { ...base.captions, ...raw.captions },
  }
}
