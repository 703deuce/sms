import 'server-only'

import type { ClipWord } from '@/lib/clips/edits'
import { openAiJsonResponse } from '@/lib/server/ai/openai-json'

export type AutoBrollPlacement = {
  atMs: number
  durationMs: number
  query: string
  must_include: string[]
}

export type AutoBrollPlacementDrop = { index: number; reason: string }

export type AutoBrollPlacementResult = {
  placements: AutoBrollPlacement[]
  rawCount: number
  dropReasons: AutoBrollPlacementDrop[]
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
- Queries must relate to the transcript, not generic associations
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

function stemToken(t: string): string {
  const s = t.toLowerCase().replace(/[^a-z0-9']/g, '').trim()
  if (s.length <= 3) return s
  if (s.endsWith('ies') && s.length > 4) return s.slice(0, -3) + 'y'
  if (s.endsWith('es') && s.length > 4) return s.slice(0, -2)
  if (s.endsWith('s') && !s.endsWith('ss')) return s.slice(0, -1)
  return s
}

function tokensMatchTranscript(keyword: string, haystack: string): boolean {
  const k = stemToken(keyword)
  if (!k || k.length < 2) return false
  const lower = haystack.toLowerCase()
  if (lower.includes(keyword.toLowerCase())) return true
  const words = lower.split(/\s+/).filter(Boolean)
  return words.some((w) => {
    const stem = stemToken(w)
    return stem === k || stem.startsWith(k) || k.startsWith(stem)
  })
}

function queryFallbackKeywords(query: string): string[] {
  return query
    .toLowerCase()
    .split(/[\s,]+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 3)
    .slice(0, 3)
}

function normalizeAtMs(raw: number, outputDurationMs: number): number {
  let atMs = Math.max(0, Math.floor(Number(raw) || 0))
  if (atMs < 1500 && atMs > 0 && atMs * 1000 <= outputDurationMs + 500) {
    atMs = atMs * 1000
  }
  return atMs
}

function filterPlacements(input: {
  words: ClipWord[]
  outputDurationMs: number
  raw: AutoBrollPlacement[]
}): AutoBrollPlacementResult {
  const transcript = input.words.map((w) => w.w).join(' ')
  const out: AutoBrollPlacement[] = []
  const dropReasons: AutoBrollPlacementDrop[] = []
  const placements = input.raw.slice(0, 5)

  placements.forEach((p, index) => {
    const atMs = normalizeAtMs(Number(p.atMs), input.outputDurationMs)
    if (atMs < 1500) {
      dropReasons.push({ index, reason: 'before_hook_1500ms' })
      return
    }
    const durationMs = Math.min(4000, Math.max(2000, Math.floor(Number(p.durationMs) || 2500)))
    const query = String(p.query || '').trim().slice(0, 80)
    if (!query) {
      dropReasons.push({ index, reason: 'empty_query' })
      return
    }
    let must_include = (p.must_include || []).map((s) => String(s).trim().toLowerCase()).filter(Boolean).slice(0, 2)
    if (!must_include.length) must_include = queryFallbackKeywords(query)
    if (!must_include.length) {
      dropReasons.push({ index, reason: 'no_keywords' })
      return
    }
    const near = excerptAroundMs(input.words, atMs)
    const spoken = must_include.some((k) => tokensMatchTranscript(k, near))
    const inTranscript = must_include.some((k) => tokensMatchTranscript(k, transcript))
    const queryWords = queryFallbackKeywords(query)
    const queryOk = queryWords.some((k) => tokensMatchTranscript(k, near) || tokensMatchTranscript(k, transcript))
    if (!spoken && !inTranscript && !queryOk) {
      dropReasons.push({ index, reason: 'transcript_mismatch' })
      return
    }
    out.push({ atMs, durationMs, query, must_include })
  })

  return { placements: out, rawCount: placements.length, dropReasons }
}

async function fetchPlacements(input: {
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
  return (raw.placements || []).slice(0, 5)
}

export async function suggestAutoBrollPlacements(input: {
  clipTitle: string
  words: ClipWord[]
  outputDurationMs: number
}): Promise<AutoBrollPlacementResult> {
  let raw = await fetchPlacements(input)
  let filtered = filterPlacements({ ...input, raw })
  if (!filtered.placements.length && filtered.rawCount > 0) {
    raw = await fetchPlacements(input)
    filtered = filterPlacements({ ...input, raw })
    filtered.dropReasons.unshift({ index: -1, reason: 'llm_retry_after_all_dropped' })
  }
  return filtered
}

/** @internal tests */
export const __testAutoBroll = { filterPlacements, normalizeAtMs, tokensMatchTranscript }
