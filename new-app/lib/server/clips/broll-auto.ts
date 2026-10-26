import 'server-only'

import { randomUUID } from 'crypto'

import type { BrollItem } from '@/lib/clips/broll'
import { outputDurationMs, type ClipEditsV2, type ClipWord } from '@/lib/clips/edits'
import { wordsAfterEdits } from '@/lib/clips/edits'
import { findCachedHit, searchVideos } from '@/lib/server/ai/pixabay'
import { ensureStockAsset } from '@/lib/server/ai/pixabay'

const STOP = new Set(
  'about after all also and any are as at be been before being but by can could did do does doing done for from had has have having he her here him his how i if in into is it its just like me more my no not of on one or our out over she so some than that the their them then there these they this those through to too up us was we were what when where which who why will with would you your'.split(
    ' ',
  ),
)

const SHOT_MS = 2500
const MIN_START_MS = 2000
const MIN_GAP_MS = 6000
const MAX_SHOTS = 3
const END_PAD_MS = 1000

export function topNounsFromWords(words: ClipWord[], n = 3): string[] {
  const counts = new Map<string, number>()
  for (const w of words) {
    const t = w.w.replace(/[^a-zA-Z]/g, '').toLowerCase()
    if (t.length < 5 || STOP.has(t)) continue
    counts.set(t, (counts.get(t) || 0) + 1)
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([w]) => w)
}

function sentenceStartForIdea(words: ClipWord[], idea: string): number | null {
  const needle = idea.toLowerCase()
  for (const w of words) {
    if (w.w.toLowerCase().includes(needle)) return Math.round(w.s * 1000)
  }
  return null
}

export async function buildAutoBrollItems(
  edits: ClipEditsV2,
  sourceWords: ClipWord[],
  ideas: string[],
): Promise<BrollItem[]> {
  const { words } = wordsAfterEdits(sourceWords, edits)
  const outDur = outputDurationMs(edits)
  const queries = ideas.length ? ideas.slice(0, 3) : topNounsFromWords(words, 3)
  const items: BrollItem[] = []
  let lastStart = -MIN_GAP_MS

  for (const idea of queries) {
    if (items.length >= MAX_SHOTS) break
    const hits = await searchVideos(idea, 1)
    const hit = hits.find((h) => h.durationS >= 3)
    if (!hit) continue
    const internal = await findCachedHit(hit.providerId)
    if (!internal) continue
    const { asset } = await ensureStockAsset(internal)

    let startMs = sentenceStartForIdea(words, idea) ?? 0
    if (startMs < MIN_START_MS) startMs = MIN_START_MS
    if (startMs - lastStart < MIN_GAP_MS) startMs = lastStart + MIN_GAP_MS
    if (startMs + SHOT_MS > outDur - END_PAD_MS) {
      const slots = MAX_SHOTS - items.length
      startMs = Math.max(MIN_START_MS, Math.floor((outDur - END_PAD_MS - SHOT_MS) / (slots + 1)) * (items.length + 1))
    }
    if (startMs + SHOT_MS > outDur - END_PAD_MS) continue

    items.push({
      id: randomUUID(),
      source: 'stock',
      assetId: asset.id,
      startMs,
      endMs: startMs + SHOT_MS,
    })
    lastStart = startMs
  }

  return items
}
