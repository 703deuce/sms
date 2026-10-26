import 'server-only'

import type { ClipWord } from '@/lib/clips/edits'
import { openAiJsonResponse } from '@/lib/server/ai/openai-json'

export type AutoBrollPlacement = {
  atMs: number
  durationMs: number
  query: string
  must_include: string[]
}

const SYSTEM = `You suggest stock B-roll placements for a short social clip.
Return JSON {"placements":[...]} where each placement has:
- atMs: integer ms on the clip timeline (output time, after edits)
- durationMs: 2000-4000
- query: 2-4 generic stock-footage search terms (objects, actions, settings you can film)
- must_include: 1-2 generic visual keywords that must appear in stock video tags

Rules:
- Between 3 and 5 placements when the clip is long enough; never fewer than 3 unless duration is under 8s
- Only where a concrete visual noun is spoken (objects, actions you can film)
- Never place in the first 1500ms (hook)
- Queries must relate to the transcript, not random associations
- NEVER use proper nouns, brand names, character names, franchises, or licensed IP (no "Peanuts", "Marvel", "Disney", celebrity names, etc.)
- Use generic visuals only: e.g. "newspaper comic strip", "stack of comic books", "reading a comic book" — not character-specific terms`

function excerptAroundMs(words: ClipWord[], atMs: number, padMs = 2000): string {
  const lo = (atMs - padMs) / 1000
  const hi = (atMs + padMs) / 1000
  return words
    .filter((w) => w.e >= lo && w.s <= hi)
    .map((w) => w.w)
    .join(' ')
    .slice(0, 500)
}

export async function suggestAutoBrollPlacements(input: {
  clipTitle: string
  words: ClipWord[]
  outputDurationMs: number
}): Promise<AutoBrollPlacement[]> {
  const transcript = input.words.map((w) => w.w).join(' ').slice(0, 4000)
  const user = `Clip title: ${input.clipTitle}
Duration ms: ${input.outputDurationMs}
Full transcript: ${transcript}

Suggest placements with atMs spread across the clip. For each placement, the query must match words spoken near that time.`

  const raw = await openAiJsonResponse<{ placements?: AutoBrollPlacement[] }>(SYSTEM, user)
  const placements = (raw.placements || []).slice(0, 5)
  const out: AutoBrollPlacement[] = []
  for (const p of placements) {
    const atMs = Math.max(0, Math.floor(Number(p.atMs)))
    if (atMs < 1500) continue
    const durationMs = Math.min(4000, Math.max(2000, Math.floor(Number(p.durationMs) || 2500)))
    const query = String(p.query || '').trim().slice(0, 80)
    const must_include = (p.must_include || []).map((s) => String(s).trim().toLowerCase()).filter(Boolean).slice(0, 2)
    if (!query || must_include.length === 0) continue
    const near = excerptAroundMs(input.words, atMs)
    const spoken = must_include.some((k) => near.toLowerCase().includes(k))
    if (!spoken && !must_include.some((k) => transcript.toLowerCase().includes(k))) continue
    out.push({ atMs, durationMs, query, must_include })
  }
  return out
}
