/** Clip finder reason tag — keep in sync with worker/clips_worker/reason_tag.py */

export const VISUAL_IOU_MIN = 0.3
export const SPEECH_WPS_MIN = 0.8

export type ReasonTag = 'speech' | 'visual' | 'both'

export type ReasonTagAiMeta = {
  reasonTag?: ReasonTag
  videoMomentMatchIou?: number
  videoWhy?: string
  wordsPerSec?: number
}

export function wordsPerSecond(
  words: { s: number; e: number }[],
  startMs: number,
  endMs: number,
): number {
  const spanS = Math.max(0.001, (endMs - startMs) / 1000)
  let n = 0
  for (const w of words) {
    const ws = w.s * 1000
    const we = w.e * 1000
    if (we >= startMs && ws <= endMs) n += 1
  }
  return n / spanS
}

export function inferReasonTag(opts: {
  aiMeta?: ReasonTagAiMeta | null
  wps: number
  mode?: string | null
}): ReasonTag {
  const iou = Number(opts.aiMeta?.videoMomentMatchIou ?? 0)
  const matched = iou >= VISUAL_IOU_MIN
  const m = (opts.mode || '').toLowerCase()
  if (m === 'anything') return opts.wps < SPEECH_WPS_MIN ? 'visual' : 'both'
  if (matched && opts.wps < SPEECH_WPS_MIN) return 'visual'
  if (matched) return 'both'
  return 'speech'
}

export function clipReasonTag(
  aiMeta: ReasonTagAiMeta | null | undefined,
  fallback?: { wps: number; mode?: string | null; startMs: number; endMs: number; words?: { s: number; e: number }[] },
): ReasonTag {
  const stored = aiMeta?.reasonTag
  if (stored === 'speech' || stored === 'visual' || stored === 'both') return stored
  if (!fallback) return 'speech'
  const wps =
    typeof aiMeta?.wordsPerSec === 'number'
      ? aiMeta.wordsPerSec
      : fallback.words
        ? wordsPerSecond(fallback.words, fallback.startMs, fallback.endMs)
        : fallback.wps
  return inferReasonTag({ aiMeta, wps, mode: fallback.mode })
}

export function reasonTagLabel(tag: ReasonTag): string {
  if (tag === 'visual') return 'Visual'
  if (tag === 'both') return 'Both'
  return 'Speech'
}
