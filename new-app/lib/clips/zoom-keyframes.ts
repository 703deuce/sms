export type ZoomSettings = {
  enabled?: boolean
  intensity?: number
}

/** Punch: rise ~0.25s, hold 0.8–1.5s, release ~0.4s; max one per 4s; cap 1.15×. */
export const ZOOM_PUNCH_RISE_S = 0.25
export const ZOOM_PUNCH_HOLD_S = 1.0
export const ZOOM_PUNCH_RELEASE_S = 0.4
export const ZOOM_MIN_GAP_S = 4
export const ZOOM_MAX_INTENSITY = 1.15
export const ZOOM_DEFAULT_INTENSITY = 1.12
/** @deprecated use ZOOM_PUNCH_RISE_S + hold + release */
export const ZOOM_PUNCH_DURATION_S = ZOOM_PUNCH_RISE_S
export const ZOOM_LAYOUT_SWITCH_GUARD_S = 0.35

export function clampZoomIntensity(intensity: number | undefined): number {
  const n = Number(intensity)
  if (!Number.isFinite(n)) return ZOOM_DEFAULT_INTENSITY
  return Math.min(ZOOM_MAX_INTENSITY, Math.max(1, n))
}

/** Output-timeline seconds where speaker/layout segment changes (skip punch near cuts). */
export function layoutSwitchTimesFromWords(
  words: { s: number; e: number; spk?: string }[],
): number[] {
  const times: number[] = []
  for (let i = 1; i < words.length; i++) {
    const a = words[i - 1]?.spk
    const b = words[i]?.spk
    if (a != null && b != null && a !== b) {
      times.push(words[i].s)
    }
  }
  return times
}

function nearLayoutSwitch(t: number, switches: number[], guard: number): boolean {
  return switches.some((sw) => Math.abs(t - sw) <= guard)
}

/** Greedy spacing: at most one emphasis punch per ZOOM_MIN_GAP_S. */
export function pickZoomPeakTimes(
  candidateTimes: number[],
  durationS: number,
  layoutSwitches: number[] = [],
): number[] {
  const sorted = [...candidateTimes].filter((t) => t > 0 && t < durationS).sort((a, b) => a - b)
  const kept: number[] = []
  for (const t of sorted) {
    if (nearLayoutSwitch(t, layoutSwitches, ZOOM_LAYOUT_SWITCH_GUARD_S)) continue
    if (kept.length && t - kept[kept.length - 1] < ZOOM_MIN_GAP_S) continue
    kept.push(t)
  }
  return kept
}

/** Keyframes on output timeline (seconds). */
export function buildZoomKeyframes(
  words: { s: number; e: number; w: string; i?: number }[],
  emphasis: number[],
  durationS: number,
  intensity?: number,
  layoutSwitches?: number[],
): { t: number; z: number }[] {
  const peakZ = clampZoomIntensity(intensity)
  if (!durationS || durationS <= 0) return [{ t: 0, z: 1 }]
  const switches = layoutSwitches ?? layoutSwitchTimesFromWords(words)
  const candidates: number[] = []
  for (const idx of emphasis) {
    const w = words.find((x) => x.i === idx)
    if (w) candidates.push(w.s)
  }
  const peaks = pickZoomPeakTimes(candidates, durationS, switches)
  const out: { t: number; z: number }[] = [{ t: 0, z: 1 }]
  for (const t of peaks) {
    const tRise = Math.min(durationS, t + ZOOM_PUNCH_RISE_S)
    const tHold = Math.min(durationS, tRise + ZOOM_PUNCH_HOLD_S)
    const tEnd = Math.min(durationS, tHold + ZOOM_PUNCH_RELEASE_S)
    out.push({ t: Math.max(0, t), z: 1 })
    out.push({ t: tRise, z: peakZ })
    out.push({ t: tHold, z: peakZ })
    out.push({ t: tEnd, z: 1 })
  }
  out.push({ t: durationS, z: 1 })
  out.sort((a, b) => a.t - b.t)
  const deduped: { t: number; z: number }[] = []
  for (const k of out) {
    const prev = deduped[deduped.length - 1]
    if (prev && Math.abs(prev.t - k.t) < 0.001) {
      prev.z = k.z
    } else {
      deduped.push({ ...k })
    }
  }
  return deduped
}
