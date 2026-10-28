import type { ClipProjectSettings } from '@/lib/clips/settings'

export const clipLenModes = ['auto', 'target'] as const
export type ClipLenMode = (typeof clipLenModes)[number]

export const fixedClipLengthSeconds = [15, 30, 60, 90] as const
export type FixedClipLengthSeconds = (typeof fixedClipLengthSeconds)[number]

export type ClipLengthChoice = 'auto' | FixedClipLengthSeconds

export const clipLengthChoiceLabels: Record<ClipLengthChoice, string> = {
  auto: 'Auto (AI picks, up to 90s)',
  15: 'Up to 15s',
  30: 'Up to 30s',
  60: 'Up to 60s',
  90: 'Up to 90s',
}

export const clipLengthChoices: ClipLengthChoice[] = ['auto', 15, 30, 60, 90]

/** Worker PROCESS_PROJECT payload field — null means Auto (AI up to 90s). */
export function targetClipLenSForJobPayload(settings: unknown): number | null {
  const s = (typeof settings === 'object' && settings ? settings : {}) as Record<string, unknown>
  if (s.clipLenMode === 'auto') return null
  if (s.clipLenMode === 'target' && typeof s.targetClipLenS === 'number') {
    return s.targetClipLenS
  }
  const legacy = s.clipLength
  if (legacy === 'lt30') return 30
  if (legacy === '30_60') return 60
  if (legacy === '60_90') return 90
  return null
}

export function clipLengthChoiceFromSettings(settings: {
  clipLenMode?: ClipLenMode
  targetClipLenS?: number | null
  clipLength?: string
}): ClipLengthChoice {
  if (settings.clipLenMode === 'target' && settings.targetClipLenS != null) {
    const n = settings.targetClipLenS
    if (n === 15 || n === 30 || n === 60 || n === 90) return n
  }
  if (settings.clipLenMode === 'auto') return 'auto'
  if (settings.clipLength === 'lt30') return 30
  if (settings.clipLength === '30_60') return 60
  if (settings.clipLength === '60_90') return 90
  return 'auto'
}

export function applyClipLengthChoice(
  settings: ClipProjectSettings,
  choice: ClipLengthChoice,
): ClipProjectSettings {
  if (choice === 'auto') {
    return {
      ...settings,
      clipLenMode: 'auto',
      targetClipLenS: null,
      clipLength: 'auto',
    }
  }
  const legacy =
    choice === 15 ? 'lt30' : choice === 30 ? 'lt30' : choice === 60 ? '30_60' : '60_90'
  return {
    ...settings,
    clipLenMode: 'target',
    targetClipLenS: choice,
    clipLength: legacy,
  }
}

export function streamerClipLengthFields(choice: ClipLengthChoice): {
  clipLenMode: ClipLenMode
  targetClipLenS: number | null
} {
  if (choice === 'auto') return { clipLenMode: 'auto', targetClipLenS: null }
  return { clipLenMode: 'target', targetClipLenS: choice }
}
