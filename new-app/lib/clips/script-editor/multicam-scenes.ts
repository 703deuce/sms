import type { EditorWord } from '@/lib/clips/script-editor/to-editor-words'

export type MulticamOptions = {
  minHoldMs: number
  wideEveryMs: number
  overlapMs: number
}

const DEFAULTS: MulticamOptions = {
  minHoldMs: 2000,
  wideEveryMs: 45_000,
  overlapMs: 1000,
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

function wordIdAtMs(words: EditorWord[], ms: number): string {
  for (const w of words) {
    if (w.t0Ms <= ms && ms < w.t1Ms) return w.id
  }
  for (const w of words) {
    if (w.t0Ms >= ms) return w.id
  }
  return words[words.length - 1]?.id ?? 'w0'
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
    const seg = segs[i]!
    const dur = seg.endMs - seg.startMs
    const next = segs[i + 1]
    const overlap =
      next && next.startMs < seg.endMs ? seg.endMs - Math.max(seg.startMs, next.startMs) : 0

    let wideAt = wideAnchor + o.wideEveryMs
    while (wideAt < seg.endMs - 400) {
      if (wideAt >= seg.startMs + o.minHoldMs) {
        const startWordId = wordIdAtMs(orderedWords, wideAt)
        scenes.push({
          id: `scn_mc_wide_${Math.round(wideAt)}`,
          startWordId,
          label: 'Wide',
          layoutId: 'grid:alt',
        })
        lastSwitchMs = wideAt
        lastLayout = 'grid:alt'
        wideAnchor = wideAt
      }
      wideAt += o.wideEveryMs
    }

    const needWideRhythm = seg.startMs - wideAnchor >= o.wideEveryMs
    const needWideOverlap = overlap >= o.overlapMs
    const needWideShort = dur < 1200
    const layoutId =
      needWideRhythm || needWideOverlap
        ? 'grid:alt'
        : needWideShort
          ? 'grid'
          : `speaker:${seg.speakerId.replace('spk:', '')}`
    const holdOk = seg.startMs - lastSwitchMs >= o.minHoldMs
    if (i === 0 || (holdOk && layoutId !== lastLayout)) {
      scenes.push({
        id: `scn_mc_${seg.startWordId.replace(/[^a-zA-Z0-9]/g, '_')}`,
        startWordId: seg.startWordId,
        label: needWideRhythm || needWideOverlap ? 'Wide' : needWideShort ? 'Hold' : seg.speakerId,
        layoutId,
      })
      lastSwitchMs = seg.startMs
      lastLayout = layoutId
      if (needWideRhythm || needWideOverlap) wideAnchor = seg.startMs
    }
  }
  scenes.sort((a, b) => {
    const ta = orderedWords.find((w) => w.id === a.startWordId)?.t0Ms ?? 0
    const tb = orderedWords.find((w) => w.id === b.startWordId)?.t0Ms ?? 0
    return ta - tb
  })
  return scenes
}
