import 'server-only'
import { t2vLlmJson } from '@/lib/server/t2v/pipeline/t2v-llm'
import { logT2v } from '@/lib/server/t2v/log'
import type { T2vPlannedShot, T2vShotResult, T2vVerifiedPick } from '@/lib/t2v/pipeline/t2v-types'

/**
 * HARD RULE (Prompt-to-Video): a shot never repeats. No stock clip ID twice in one video, and no two
 * visually near-identical shots (same subject AND framing), whether from the same or different clips.
 *
 * 1. Deterministic pass in story order: clip ID + dHash frame similarity (worker-computed).
 * 2. One cheap text-only LLM pass over the reviewer's descriptions to catch look-alikes from different
 *    clips (e.g. two charging-plug close-ups) that a perceptual hash misses.
 * A replaced shot takes the scene's next distinct reviewed clip; if none, it is left empty so the
 * finisher continues the previous shot (one continuous take) instead of re-showing anything.
 */
const NEAR_DUP_BITS = 10
const ACCEPT_SCORE = 7

function hamming(a: string, b: string): number {
  let n = 0
  for (let i = 0; i < a.length; i++) {
    let x = parseInt(a[i]!, 16) ^ parseInt(b[i]!, 16)
    while (x) {
      n += x & 1
      x >>= 1
    }
  }
  return n
}

export function nearDuplicateHash(a: string[] | undefined, b: string[] | undefined): boolean {
  for (const x of a ?? []) for (const y of b ?? []) if (/^[0-9a-f]{16}$/.test(x) && /^[0-9a-f]{16}$/.test(y) && hamming(x, y) <= NEAR_DUP_BITS) return true
  return false
}

type Ev = T2vShotResult['evaluated'][number]

function usable(e: Ev, realistic: boolean, minScore: number): boolean {
  if (e.error || typeof e.score !== 'number' || e.score < minScore) return false
  if (realistic && e.style && e.style !== 'live_action') return false
  return true
}

function toPick(e: Ev, verdict: T2vVerifiedPick['verdict']): T2vVerifiedPick {
  return {
    provider: e.provider ?? 'pixabay',
    providerId: e.providerId,
    query: e.query,
    visible: e.visible ?? '',
    subject: e.subject,
    action: e.action,
    matches: Boolean(e.matches),
    score: e.score ?? 0,
    inS: e.inS ?? 0,
    outS: e.outS ?? 0,
    clipS: e.clipS ?? 0,
    issues: e.issues,
    style: e.style,
    lighting: e.lighting,
    framing: e.framing,
    phash: e.phash,
    verdict,
  }
}

function rank(e: Ev): number {
  return (e.score ?? 0) + 0.15 * (e.lighting ?? 5) + (e.matches ? 1 : 0)
}

/** Deterministic pass: unique clip IDs, no dHash look-alikes, fill empty scenes with distinct fallbacks. */
export function enforceNoRepeatDeterministic(
  shots: T2vPlannedShot[],
  results: Record<string, T2vShotResult>,
  realistic: boolean,
  banned: Record<string, Set<string>> = {},
): { out: Record<string, T2vShotResult>; replaced: number } {
  const out: Record<string, T2vShotResult> = {}
  const usedIds = new Set<string>()
  const usedHashes: string[][] = []
  let replaced = 0
  const free = (e: { providerId: string; phash?: string[] }, sceneId: string) =>
    !usedIds.has(e.providerId) && !banned[sceneId]?.has(e.providerId) && !usedHashes.some((h) => nearDuplicateHash(e.phash, h))
  for (const shot of shots) {
    const r = results[shot.sceneId] ?? { sceneId: shot.sceneId, chosen: null, evaluated: [] }
    let chosen: T2vVerifiedPick | null = r.chosen && free(r.chosen, shot.sceneId) ? r.chosen : null
    if (r.chosen && !chosen) replaced++
    if (!chosen) {
      const alts = r.evaluated.filter((e) => free(e, shot.sceneId)).sort((a, b) => rank(b) - rank(a))
      const good = alts.find((e) => usable(e, realistic, ACCEPT_SCORE) && e.matches && (e.lighting ?? 10) >= 4)
      const ok = good ?? alts.find((e) => usable(e, realistic, 3)) ?? alts.find((e) => usable(e, false, 3))
      if (ok) chosen = toPick(ok, good ? 'accepted' : 'best_available')
    }
    if (chosen) {
      usedIds.add(chosen.providerId)
      if (chosen.phash?.length) usedHashes.push(chosen.phash)
    }
    out[shot.sceneId] = { ...r, chosen }
  }
  return { out, replaced }
}

const LOOKALIKE_SYSTEM = `You check a stock-footage edit for repeated-looking shots. Each item is one shot (in order)
described by a reviewer. Two shots are "near-identical" only when a viewer would feel the same shot was shown
twice: same main subject AND same framing/shot size AND similar setting (e.g. two close-ups of a charging plug
in a car port; two aerials of the same kind of highway). Different subjects, or the same subject in clearly
different framing (wide vs close-up, interior vs exterior), are NOT near-identical.
Return ONLY JSON: {"pairs": [[earlierIndex, laterIndex], ...]} (empty list if none).`

/** Text-only look-alike pass (one LLM call per round). Returns the later index of each near-identical pair. */
async function lookalikes(items: Array<{ index: number; framing: string; subject: string; visible: string }>): Promise<number[]> {
  if (items.length < 2) return []
  const out = await t2vLlmJson<{ pairs?: unknown[] }>(LOOKALIKE_SYSTEM, `Shots: ${JSON.stringify(items)}`, { maxTokens: 1500 })
  const later = new Set<number>()
  for (const p of Array.isArray(out.pairs) ? out.pairs : []) {
    if (Array.isArray(p) && p.length === 2) {
      const [a, b] = p.map(Number)
      if (Number.isInteger(a) && Number.isInteger(b) && a !== b) later.add(Math.max(a!, b!))
    }
  }
  return [...later]
}

export async function enforceNoRepeat(
  shots: T2vPlannedShot[],
  results: Record<string, T2vShotResult>,
  realistic: boolean,
): Promise<{ results: Record<string, T2vShotResult>; replaced: number; lookalikeSwaps: number }> {
  const banned: Record<string, Set<string>> = {}
  let { out, replaced } = enforceNoRepeatDeterministic(shots, results, realistic, banned)
  let lookalikeSwaps = 0
  // Up to 2 look-alike passes: ban the later shot's clip for that scene, then re-run the deterministic pass.
  for (let pass = 0; pass < 2; pass++) {
    const items = shots
      .map((s, index) => ({ s, index, c: out[s.sceneId]?.chosen }))
      .filter((x) => x.c)
      .map((x) => ({ index: x.index, framing: x.c!.framing ?? '', subject: x.c!.subject ?? '', visible: (x.c!.visible ?? '').slice(0, 160) }))
    let dups: number[] = []
    try {
      dups = await lookalikes(items)
    } catch (err) {
      logT2v('pipeline-norepeat', 'lookalike check failed (deterministic pass still applied)', { error: err instanceof Error ? err.message : 'error' })
      break
    }
    if (!dups.length) break
    for (const i of dups) {
      const s = shots[i]
      const c = s && out[s.sceneId]?.chosen
      if (!s || !c) continue
      ;(banned[s.sceneId] ??= new Set()).add(c.providerId)
      lookalikeSwaps++
    }
    ;({ out, replaced } = enforceNoRepeatDeterministic(shots, out, realistic, banned))
  }
  logT2v('pipeline-norepeat', 'done', { shots: shots.length, replaced, lookalikeSwaps })
  return { results: out, replaced, lookalikeSwaps }
}
