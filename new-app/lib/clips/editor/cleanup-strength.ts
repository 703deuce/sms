/** AI_QUALITY Q1 cleanup strength presets (TB-04/05). */

export type CleanupStrength = 'light' | 'normal' | 'aggressive'

export const DEFAULT_CLEANUP_STRENGTH: CleanupStrength = 'normal'

export const OPT_IN_FILLER_WORDS = [
  'like',
  'so',
  'you know',
  'i mean',
  'basically',
  'actually',
] as const

export type OptInFillerKey = (typeof OPT_IN_FILLER_WORDS)[number]

export function gapPresetForStrength(strength: CleanupStrength): { minGapMs: number; targetGapMs: number } {
  switch (strength) {
    case 'light':
      return { minGapMs: 1000, targetGapMs: 400 }
    case 'aggressive':
      return { minGapMs: 350, targetGapMs: 150 }
    case 'normal':
    default:
      return { minGapMs: 600, targetGapMs: 250 }
  }
}

export type FillerStrengthFilter = 'light' | 'normal' | 'aggressive'

/** Whether a filler token is eligible for removal at this strength (opt-in words excluded unless enabled). */
export function fillerEligibleAtStrength(
  wordText: string,
  fillerKind: 'lexicon' | 'repeat' | 'silence' | undefined,
  strength: FillerStrengthFilter,
  enabledOptIn: ReadonlySet<string>,
): boolean {
  const t = wordText.trim().toLowerCase()
  if (!t) return false
  if (OPT_IN_FILLER_WORDS.some((p) => t === p || t.startsWith(`${p} `))) {
    return enabledOptIn.has(t.split(/\s+/)[0] ?? t)
  }
  if (strength === 'light') {
    return /^(um+|uh+|er+|ah+)$/i.test(t) && (fillerKind === 'lexicon' || fillerKind === 'repeat' || !fillerKind)
  }
  if (strength === 'normal') {
    if (/^(um+|uh+|er+|ah+|hmm+)$/i.test(t)) return true
    return fillerKind === 'repeat'
  }
  // aggressive: normal rules + opt-in when enabled (handled above)
  if (/^(um+|uh+|er+|ah+|hmm+)$/i.test(t)) return true
  if (fillerKind === 'repeat') return true
  return enabledOptIn.has(t)
}

export function isProtectedFromCleanup(word: {
  text: string
  conf?: number
  isFiller?: boolean
}): boolean {
  const t = word.text.trim().toLowerCase()
  if (/\[(laughter|noise|music|applause)\]/i.test(t) || t === '[laughter]') return true
  if (typeof word.conf === 'number' && word.conf > 0 && word.conf < 0.45) return true
  return false
}

export function gapHasSpeechEnergy(
  gapStartMs: number,
  gapEndMs: number,
  rmsSamples: { tMs: number; rms: number }[] | null | undefined,
  noiseFloor = 0.08,
): boolean {
  if (!rmsSamples?.length || gapEndMs <= gapStartMs) return false
  let speechMs = 0
  for (const s of rmsSamples) {
    if (s.tMs < gapStartMs || s.tMs > gapEndMs) continue
    if (s.rms > noiseFloor) speechMs += 40
  }
  return speechMs > 150
}
