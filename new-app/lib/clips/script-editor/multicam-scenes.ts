import type { EditorWord } from '@/lib/clips/script-editor/to-editor-words'

export type MulticamOptions = {
  minHoldMs: number
  wideEveryMs: number
  overlapMs: number
}

const DEFAULTS: MulticamOptions = {
  minHoldMs: 2000,
  wideEveryMs: 45_000,
  overlapMs: 800,
}

type Segment = { speakerId: string; startWordId: string; startMs: number; endMs: number }

function speakerSegments(words: EditorWord[]): Segment[] {
  const segs: Segment[] = []
  let cur: Segment | null = null
  for (const w of words) {
    if (!cur || cur.speakerId !== w.speakerId) {
      if (cur) segs.push(cur)
      cur = { speakerId: w.speakerId, startWordId: w.id, startMs: w.t0Ms, endMs: w.t1Ms }
    } else {
      cur.endMs = w.t1Ms
    }
  }
  if (cur) segs.push(cur)
  return segs
}

/** Active-speaker multicam scenes (D8 rules, single-track diarization). */
export function buildAutoMulticamScenes(
  orderedWords: EditorWord[],
  opts: Partial<MulticamOptions> = {},
): { id: string; startWordId: string; label: string; layoutId: string }[] {
  const o = { ...DEFAULTS, ...opts }
  const segs = speakerSegments(orderedWords)
  if (!segs.length) return []

  const scenes: { id: string; startWordId: string; label: string; layoutId: string }[] = []
  let lastSwitchMs = segs[0].startMs
  let lastLayout = 'speaker:active'
  let wideAnchor = segs[0].startMs

  for (let i = 0; i < segs.length; i++) {
    const seg = segs[i]
    const dur = seg.endMs - seg.startMs
    const next = segs[i + 1]
    const overlap =
      next && next.startMs < seg.endMs ? seg.endMs - Math.max(seg.startMs, next.startMs) : 0
    const needWide =
      overlap >= o.overlapMs || seg.startMs - wideAnchor >= o.wideEveryMs || dur < 1200
    const holdOk = seg.startMs - lastSwitchMs >= o.minHoldMs
    const layoutId = needWide ? 'grid' : `speaker:${seg.speakerId.replace('spk:', '')}`
    if (i === 0 || (holdOk && layoutId !== lastLayout)) {
      scenes.push({
        id: `scn_mc_${seg.startWordId.replace(/[^a-zA-Z0-9]/g, '_')}`,
        startWordId: seg.startWordId,
        label: needWide ? 'Wide' : seg.speakerId,
        layoutId,
      })
      lastSwitchMs = seg.startMs
      lastLayout = layoutId
      if (needWide) wideAnchor = seg.startMs
    }
  }
  return scenes
}
