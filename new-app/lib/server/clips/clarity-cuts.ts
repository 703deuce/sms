import 'server-only'

import type { CutRange } from '@/lib/clips/edits'
import { wordSourceMs } from '@/lib/clips/source-words'
import { snapCutRangeToWordGaps } from '@/lib/clips/word-cut'
import { loadClipWordsForLlm } from '@/lib/server/clips/caption-emojis'
import { openAiJsonWithGeminiFallback } from '@/lib/server/ai/openai-json'

const SYSTEM = `You tighten a spoken clip by proposing word ranges to DELETE (not rewrite).
Return JSON {"cuts":[{"from":number,"to":number,"reason":"filler"|"repeat"|"false_start"|"ramble"}]}.
Only propose deletions: fillers, repeated phrases, false starts, rambling restarts. Never rewrite words.`

export type ClarityCutReason = 'filler' | 'repeat' | 'false_start' | 'ramble'

export type ClarityCutProposal = {
  from: number
  to: number
  startMs: number
  endMs: number
  reason: ClarityCutReason
  text: string
}

function wordMidInCut(midMs: number, cuts: CutRange[]): boolean {
  return cuts.some(([a, b]) => midMs >= a && midMs < b)
}

function rangeOverlaps(a: CutRange, b: CutRange): boolean {
  const [a0, a1] = a[0] <= a[1] ? a : [a[1], a[0]]
  const [b0, b1] = b[0] <= b[1] ? b : [b[1], b[0]]
  return a0 < b1 && b0 < a1
}

function indexSpanToMs(from: number, to: number, span: Awaited<ReturnType<typeof loadClipWordsForLlm>>['inSpan']): CutRange | null {
  const lo = Math.min(from, to)
  const hi = Math.max(from, to)
  const picked = span.filter((w) => w.i >= lo && w.i <= hi)
  if (!picked.length) return null
  let startMs = Infinity
  let endMs = -Infinity
  for (const w of picked) {
    const { startMs: s, endMs: e } = wordSourceMs(w)
    startMs = Math.min(startMs, s)
    endMs = Math.max(endMs, e)
  }
  if (!Number.isFinite(startMs) || endMs <= startMs) return null
  return [startMs, endMs]
}

export async function suggestClarityCuts(
  workspaceId: string,
  clipId: string,
): Promise<{ proposals: ClarityCutProposal[]; warning?: string }> {
  try {
    const { inSpan, edits } = await loadClipWordsForLlm(workspaceId, clipId)
    if (!inSpan.length) return { proposals: [] }

    const indexed = inSpan.slice(0, 1500)
    const wordCount = indexed.length
    const maxWordsTotal = Math.max(1, Math.floor(wordCount * 0.25))
    const excerpt = indexed.map((w) => `${w.i}:${w.w}`).join(' ').slice(0, 12_000)

    const raw = await openAiJsonWithGeminiFallback<{ cuts?: { from: number; to: number; reason: string }[] }>(
      'clarity_cuts',
      SYSTEM,
      JSON.stringify({ words: excerpt }),
      {
        type: 'object',
        properties: {
          cuts: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                from: { type: 'number' },
                to: { type: 'number' },
                reason: { type: 'string' },
              },
            },
          },
        },
      },
    )

    const wordSpans = indexed.map((w) => {
      const { startMs, endMs } = wordSourceMs(w)
      return { s: startMs / 1000, e: endMs / 1000, w: w.w }
    })

    const validReason = (r: string): ClarityCutReason | null =>
      r === 'filler' || r === 'repeat' || r === 'false_start' || r === 'ramble' ? r : null

    const accepted: ClarityCutProposal[] = []
    let wordsInCuts = 0
    const existing = edits.cutRanges ?? []

    for (const cut of raw.cuts ?? []) {
      if (accepted.length >= 30) break
      const from = Math.floor(Number(cut.from))
      const to = Math.floor(Number(cut.to))
      if (!Number.isFinite(from) || !Number.isFinite(to)) continue
      const lo = Math.min(from, to)
      const hi = Math.max(from, to)
      const spanWords = indexed.filter((w) => w.i >= lo && w.i <= hi)
      if (!spanWords.length || hi - lo + 1 > 40) continue
      if (wordsInCuts + spanWords.length > maxWordsTotal) continue

      let msRange = indexSpanToMs(lo, hi, indexed)
      if (!msRange) continue
      if (wordSpans.length) {
        msRange = snapCutRangeToWordGaps(msRange, wordSpans) ?? msRange
      }

      const mids = spanWords.map((w) => ((w.s + w.e) / 2) * 1000)
      if (mids.every((m) => wordMidInCut(m, existing))) continue
      if (accepted.some((p) => rangeOverlaps([p.startMs, p.endMs], msRange))) continue
      if (existing.some((r) => rangeOverlaps(r, msRange))) continue

      const reason = validReason(String(cut.reason)) ?? 'filler'
      const text = spanWords.map((w) => w.w).join(' ').trim()
      accepted.push({
        from: lo,
        to: hi,
        startMs: msRange[0],
        endMs: msRange[1],
        reason,
        text,
      })
      wordsInCuts += spanWords.length
    }

    return { proposals: accepted }
  } catch (err) {
    return {
      proposals: [],
      warning: err instanceof Error ? err.message : 'Clarity suggestions unavailable',
    }
  }
}
