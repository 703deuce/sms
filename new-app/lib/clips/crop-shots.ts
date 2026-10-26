import type { CropShot } from '@/lib/server/clips/clip-detail'

type CropKeyframe = {
  startMs: number
  endMs: number
  speaker?: string
  mode?: string
  cx: number
  cy: number
  w?: number
  h?: number
  scale?: number
}

/** Merge contiguous crop.json keyframes with the same speaker/mode into editor shots (source ms). */
export function shotsFromCropJson(
  raw: { shots?: CropKeyframe[] } | CropKeyframe[] | null | undefined,
  clipStartMs: number,
  clipEndMs: number,
): CropShot[] {
  const list = Array.isArray(raw) ? raw : raw?.shots
  if (!list?.length) {
    return [
      {
        startMs: clipStartMs,
        endMs: clipEndMs,
        speaker: 'A',
        cx: 50,
        cy: 45,
        w: 100,
        h: 100,
        scale: 1.15,
      },
    ]
  }
  const normalized = list
    .map((s) => ({
      startMs: s.startMs,
      endMs: s.endMs,
      speaker: (s.speaker || s.mode || 'A').replace(/^speaker_/i, '').toUpperCase().slice(0, 1) || 'A',
      cx: s.cx,
      cy: s.cy,
      w: s.w ?? 100,
      h: s.h ?? 100,
      scale: s.scale ?? 1.15,
    }))
    .filter((s) => s.endMs > clipStartMs && s.startMs < clipEndMs)
    .sort((a, b) => a.startMs - b.startMs)

  const merged: CropShot[] = []
  for (const s of normalized) {
    const startMs = Math.max(s.startMs, clipStartMs)
    const endMs = Math.min(s.endMs, clipEndMs)
    const prev = merged[merged.length - 1]
    if (prev && prev.speaker === s.speaker && Math.abs(prev.endMs - startMs) < 120) {
      prev.endMs = endMs
      prev.cx = s.cx
      prev.cy = s.cy
      prev.scale = s.scale
    } else {
      merged.push({ ...s, startMs, endMs })
    }
  }
  return merged.length ? merged : [{ startMs: clipStartMs, endMs: clipEndMs, speaker: 'A', cx: 50, cy: 45, w: 100, h: 100, scale: 1.15 }]
}

export function shotIndexAt(shots: CropShot[], sourceMs: number): number {
  const i = shots.findIndex((s) => sourceMs >= s.startMs && sourceMs < s.endMs)
  return i >= 0 ? i : Math.max(0, shots.length - 1)
}

export function speakerLabelForWord(shots: CropShot[], sourceMidMs: number): string {
  const shot = shots[shotIndexAt(shots, sourceMidMs)]
  const sp = shot?.speaker || 'A'
  if (sp === 'A' || sp === 'B') return sp
  return sp.slice(0, 1)
}

/** Fallback when crop.json is missing: split on diarization or time alternation. */
export function inferShotsFromWords(
  words: { s: number; e: number; spk?: number }[],
  clipStartMs: number,
  clipEndMs: number,
): CropShot[] {
  const inClip = words.filter((w) => w.e * 1000 > clipStartMs && w.s * 1000 < clipEndMs)
  const hasSpk = inClip.some((w) => w.spk !== undefined && w.spk !== null)
  const shots: CropShot[] = []
  let segStart = clipStartMs
  let cur = 'A'
  const push = (endMs: number, speaker: string) => {
    if (endMs - segStart < 400) return
    shots.push({
      startMs: segStart,
      endMs,
      speaker,
      cx: speaker === 'B' ? 70 : 30,
      cy: 45,
      w: 100,
      h: 100,
      scale: 1.15,
    })
  }
  if (hasSpk) {
    for (const w of inClip) {
      const label = w.spk === 1 ? 'B' : 'A'
      const t = Math.round(w.s * 1000)
      if (label !== cur && t > segStart + 600) {
        push(t, cur)
        segStart = t
        cur = label
      }
    }
    push(clipEndMs, cur)
    return shots.length ? shots : [{ startMs: clipStartMs, endMs: clipEndMs, speaker: 'A', cx: 30, cy: 45, w: 100, h: 100, scale: 1.15 }]
  }
  const span = clipEndMs - clipStartMs
  const chunk = Math.max(8000, Math.round(span / 4))
  for (let t = clipStartMs; t < clipEndMs; t += chunk) {
    const end = Math.min(clipEndMs, t + chunk)
    shots.push({
      startMs: t,
      endMs: end,
      speaker: cur,
      cx: cur === 'A' ? 30 : 70,
      cy: 45,
      w: 100,
      h: 100,
      scale: 1.15,
    })
    cur = cur === 'A' ? 'B' : 'A'
  }
  return shots
}
