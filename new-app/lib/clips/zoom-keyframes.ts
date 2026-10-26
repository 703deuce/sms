export type ZoomSettings = {
  enabled?: boolean
  intensity?: 1.1 | 1.15 | 1.2 | 1.3
}

/** Keyframes: scale 1.0 → peak on emphasis / ~7s cadence (output timeline seconds). */
export function buildZoomKeyframes(
  words: { s: number; e: number; w: string; i?: number }[],
  emphasis: number[],
  durationS: number,
  intensity = 1.15,
): { t: number; z: number }[] {
  if (!words.length) return [{ t: 0, z: 1 }]
  const peaks = new Set<number>()
  for (const idx of emphasis) {
    const w = words.find((x) => x.i === idx)
    if (w) peaks.add(w.s)
  }
  for (let t = 0; t < durationS; t += 7) peaks.add(t)
  const sorted = [...peaks].sort((a, b) => a - b)
  const out: { t: number; z: number }[] = [{ t: 0, z: 1 }]
  for (const t of sorted) {
    if (t <= 0 || t >= durationS) continue
    out.push({ t: Math.max(0, t - 0.15), z: 1 })
    out.push({ t, z: intensity })
    out.push({ t: Math.min(durationS, t + 0.4), z: intensity })
    out.push({ t: Math.min(durationS, t + 0.55), z: 1 })
  }
  out.push({ t: durationS, z: 1 })
  return out
}
