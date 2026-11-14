import 'server-only'
import { t2vLlmJson } from '@/lib/server/t2v/pipeline/t2v-llm'
import { logT2v } from '@/lib/server/t2v/log'
import type { T2vPickedBy, T2vPlannedShot, T2vShotResult, T2vVerifiedPick } from '@/lib/t2v/pipeline/t2v-types'

/**
 * Shot sequencing for Prompt-to-Video. HARD RULE: a shot never repeats.
 * - Never the same stock clip ID twice; never two near-identical frames (worker dHash).
 * - Same shoot counts as a repeat: same author with neighbouring IDs (e.g. 24122/24123) is never placed
 *   adjacent, and is used elsewhere only when a scene has no other option.
 * - One text-only LLM pass over the reviewer's descriptions catches look-alikes from different clips and
 *   adjacent scenes that are the same kind of shot (three aerial town shots in a row).
 *
 * Every scene tries, in order: accepted (7+), usable (5-6, works for the line), loosely on-topic (3-4),
 * then a "spare" clip the reviewer rated 6+ for another line of this video (on-topic B-roll nobody used).
 * Quality rules (t2vQualityOk): live action for realistic styles, lighting >= MIN_LIGHTING, no night/dark
 * footage unless the line is about night, colour unless the request asks for black-and-white. A clip failing
 * them is a * last resort before an empty scene.
 */
const NEAR_DUP_BITS = 10
const ACCEPT_SCORE = 7
const USABLE_SCORE = 5
const LOOSE_SCORE = 3
const SPARE_SCORE = 6
export const MIN_LIGHTING = 6
/** Measured frame stats (0-1, worker): darker / greyer than this fails a normal daytime colour line. */
export const MIN_LUMA = 0.12
export const MIN_SATURATION = 0.06
const NIGHT_WORDS = /\b(night|nights|nighttime|night-time|overnight|evening|dusk|midnight|dark|darkness|after dark|neon|moonlight|stars)\b/i
const MONO_WORDS = /\b(black[- ]and[- ]white|b&w|monochrome|grayscale|greyscale|noir|desaturated|sepia)\b/i

/** A line about night may use night/dark footage; every other line needs daylight-readable shots. */
export function t2vNightLine(...texts: Array<string | undefined>): boolean {
  return texts.some((t) => NIGHT_WORDS.test(t ?? ''))
}

/** Black-and-white footage only when the request asks for it. */
export function t2vMonoRequested(prompt: string | undefined): boolean {
  return MONO_WORDS.test(prompt ?? '')
}

export type T2vQualityCtx = { realistic: boolean; nightOk: boolean; monoOk: boolean }

/** Live action (realistic styles), lit >= MIN_LIGHTING, no night/dark for day lines, colour unless asked. */
export function t2vQualityOk(e: { style?: string; lighting?: number; timeOfDay?: string; luma?: number; saturation?: number }, ctx: T2vQualityCtx): boolean {
  if (ctx.realistic && e.style && e.style !== 'live_action') return false
  if ((e.lighting ?? 10) < MIN_LIGHTING) return false
  if (!ctx.nightOk && (e.timeOfDay === 'night' || (e.luma ?? 1) < MIN_LUMA)) return false
  if (!ctx.monoOk && (e.saturation ?? 1) < MIN_SATURATION) return false
  return true
}
/** Pixabay IDs from one author this close together are almost always one shoot. */
const SAME_SHOOT_ID_GAP = 40

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

type ClipRef = { provider?: string; providerId: string; author?: string }

export function sameShoot(a: ClipRef, b: ClipRef): boolean {
  if (a.providerId === b.providerId) return true
  if (!a.author || a.author !== b.author || (a.provider ?? 'pixabay') !== (b.provider ?? 'pixabay')) return false
  const x = Number(a.providerId)
  const y = Number(b.providerId)
  return Number.isFinite(x) && Number.isFinite(y) && Math.abs(x - y) <= SAME_SHOOT_ID_GAP
}

type Ev = T2vShotResult['evaluated'][number]
type Tier = { verdict: T2vVerifiedPick['verdict']; tier: T2vPickedBy; ok: (e: Ev) => boolean }

function scored(e: Ev, min: number): boolean {
  return !e.error && typeof e.score === 'number' && e.score >= min
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
    author: e.author,
    timeOfDay: e.timeOfDay,
    saturation: e.saturation,
    luma: e.luma,
    verdict,
  }
}

/** Relevance first, then brightness (brighter wins ties and near-ties). */
function rank(e: Ev): number {
  return (e.score ?? 0) + 0.3 * (e.lighting ?? 5) + (e.matches ? 1 : 0)
}

export type NoRepeatPick = { sceneId: string; tier: string }

/** Deterministic pass (story order): unique IDs, no dHash look-alikes, same-shoot rules, tiered fill. */
export function enforceNoRepeatDeterministic(
  shots: T2vPlannedShot[],
  results: Record<string, T2vShotResult>,
  opts: { realistic: boolean; monoOk?: boolean },
  banned: Record<string, Set<string>> = {},
): { out: Record<string, T2vShotResult>; replaced: number; tiers: Record<string, T2vPickedBy> } {
  const ctxFor = (shot: T2vPlannedShot): T2vQualityCtx => ({
    realistic: opts.realistic,
    nightOk: t2vNightLine(shot.narration, shot.intent),
    monoOk: Boolean(opts.monoOk),
  })
  const out: Record<string, T2vShotResult> = {}
  const tiers: Record<string, T2vPickedBy> = {}
  const picked: T2vVerifiedPick[] = []
  let replaced = 0
  const tierList = (ctx: T2vQualityCtx): Tier[] => [
    { verdict: 'accepted', tier: 'accepted', ok: (e) => scored(e, ACCEPT_SCORE) && Boolean(e.matches) && t2vQualityOk(e, ctx) },
    { verdict: 'weak_match', tier: 'usable', ok: (e) => scored(e, USABLE_SCORE) && t2vQualityOk(e, ctx) },
    { verdict: 'best_available', tier: 'fallback', ok: (e) => scored(e, LOOSE_SCORE) && t2vQualityOk(e, ctx) },
  ]
  // On-topic B-roll the reviewer rated well for some other line of this video (quality re-checked per line).
  const spares: Ev[] = []
  const seenSpare = new Set<string>()
  for (const shot of shots) {
    for (const e of results[shot.sceneId]?.evaluated ?? []) {
      if (seenSpare.has(e.providerId) || !scored(e, SPARE_SCORE) || !t2vQualityOk(e, { realistic: opts.realistic, nightOk: true, monoOk: true })) continue
      seenSpare.add(e.providerId)
      spares.push(e)
    }
  }
  spares.sort((a, b) => rank(b) - rank(a))

  for (const shot of shots) {
    const r = results[shot.sceneId] ?? { sceneId: shot.sceneId, chosen: null, evaluated: [] }
    const ctx = ctxFor(shot)
    const last2 = picked.slice(-2)
    const free = (e: ClipRef & { phash?: string[] }, strictShoot: boolean) =>
      !banned[shot.sceneId]?.has(e.providerId) &&
      !picked.some((p) => p.providerId === e.providerId) &&
      !picked.some((p) => nearDuplicateHash(e.phash, p.phash)) &&
      !last2.some((p) => sameShoot(p, e)) &&
      (!strictShoot || !picked.some((p) => sameShoot(p, e)))
    let chosen: T2vVerifiedPick | null = null
    let tier: T2vPickedBy | '' = ''
    if (r.chosen && free(r.chosen, true) && t2vQualityOk(r.chosen, ctx)) {
      chosen = r.chosen
      tier = r.chosen.verdict === 'accepted' ? 'accepted' : r.chosen.verdict === 'weak_match' ? 'usable' : 'fallback'
    } else if (r.chosen) replaced++
    // Same-shoot elsewhere in the video only when the scene has no other option.
    for (const strict of [true, false]) {
      if (chosen) break
      const alts = r.evaluated.filter((e) => free(e, strict)).sort((a, b) => rank(b) - rank(a))
      for (const t of tierList(ctx)) {
        const hit = alts.find(t.ok)
        if (hit) {
          chosen = toPick(hit, t.verdict)
          tier = t.tier
          break
        }
      }
      if (!chosen) {
        const spare = spares.find((e) => free(e, strict) && t2vQualityOk(e, ctx))
        if (spare) {
          chosen = toPick(spare, 'best_available')
          tier = 'spare'
        }
      }
    }
    if (!chosen) {
      // Last resort before an empty scene: any loosely on-topic clip, even dim or stylised.
      const any = r.evaluated.filter((e) => free(e, false) && scored(e, LOOSE_SCORE)).sort((a, b) => rank(b) - rank(a))[0]
      if (any) {
        chosen = toPick(any, 'best_available')
        tier = 'last_resort'
      }
    }
    if (chosen) picked.push(chosen)
    if (tier) tiers[shot.sceneId] = tier
    out[shot.sceneId] = { ...r, chosen }
  }
  return { out, replaced, tiers }
}

const LOOKALIKE_SYSTEM = `You check the shot sequence of a stock-footage video for repetition. Each item is one shot,
in edit order, described by a footage reviewer.
1. "pairs": shots ANYWHERE in the list that a viewer would feel are the same shot shown twice: same main
   subject AND same framing/shot size AND similar setting (two close-ups of a charging plug; two aerials of
   the same kind of town; the same car at the same location from a slightly different angle).
2. "sameKind": CONSECUTIVE shots (positions p and p+1) that are the same kind of shot, which makes the edit
   feel monotonous: e.g. aerial town after aerial highway, traffic street after traffic highway, two static
   product close-ups in a row. Different shot kinds (aerial vs close-up of hands vs interior) are fine.
Return ONLY JSON: {"pairs": [[p, q], ...], "sameKind": [[p, p+1], ...]} using the "p" positions given.`

async function sequenceCheck(items: Array<{ p: number; framing: string; subject: string; visible: string }>): Promise<{ dup: number[]; kind: number[] }> {
  if (items.length < 2) return { dup: [], kind: [] }
  const out = await t2vLlmJson<{ pairs?: unknown[]; sameKind?: unknown[] }>(LOOKALIKE_SYSTEM, `Shots: ${JSON.stringify(items)}`, { maxTokens: 2000 })
  const later = (list: unknown[] | undefined, adjacentOnly: boolean) => {
    const s = new Set<number>()
    for (const p of Array.isArray(list) ? list : []) {
      if (!Array.isArray(p) || p.length !== 2) continue
      const [a, b] = p.map(Number)
      if (!Number.isInteger(a) || !Number.isInteger(b) || a === b) continue
      if (adjacentOnly && Math.abs(a! - b!) !== 1) continue
      s.add(Math.max(a!, b!))
    }
    return [...s]
  }
  return { dup: later(out.pairs, false), kind: later(out.sameKind, true) }
}

/** Does the scene have another good (5+, live, lit) clip besides `exceptId`? Variety swaps only then. */
function hasGoodAlternative(r: T2vShotResult | undefined, exceptId: string, banned: Set<string> | undefined, ctx: T2vQualityCtx): boolean {
  return (r?.evaluated ?? []).some((e) => e.providerId !== exceptId && !banned?.has(e.providerId) && scored(e, USABLE_SCORE) && t2vQualityOk(e, ctx))
}

export async function enforceNoRepeat(
  shots: T2vPlannedShot[],
  results: Record<string, T2vShotResult>,
  opts: { realistic: boolean; monoOk?: boolean },
): Promise<{ results: Record<string, T2vShotResult>; replaced: number; lookalikeSwaps: number; varietySwaps: number; tiers: Record<string, T2vPickedBy> }> {
  const banned: Record<string, Set<string>> = {}
  let { out, replaced, tiers } = enforceNoRepeatDeterministic(shots, results, opts, banned)
  let lookalikeSwaps = 0
  let varietySwaps = 0
  for (let pass = 0; pass < 3; pass++) {
    const seq = shots.map((s) => ({ s, c: out[s.sceneId]?.chosen })).filter((x) => x.c)
    const items = seq.map((x, p) => ({ p, framing: x.c!.framing ?? '', subject: x.c!.subject ?? '', visible: (x.c!.visible ?? '').slice(0, 160) }))
    let check: { dup: number[]; kind: number[] }
    try {
      check = await sequenceCheck(items)
    } catch (err) {
      logT2v('pipeline-norepeat', 'sequence check failed (deterministic pass still applied)', { error: err instanceof Error ? err.message : 'error' })
      break
    }
    let changed = false
    for (const p of check.dup) {
      const x = seq[p]
      if (!x) continue
      ;(banned[x.s.sceneId] ??= new Set()).add(x.c!.providerId)
      lookalikeSwaps++
      changed = true
    }
    for (const p of check.kind) {
      const x = seq[p]
      if (!x || check.dup.includes(p)) continue
      // Variety is a preference: swap only when the scene has another good clip to use.
      const ctx = { realistic: opts.realistic, nightOk: t2vNightLine(x.s.narration, x.s.intent), monoOk: Boolean(opts.monoOk) }
      if (!hasGoodAlternative(out[x.s.sceneId], x.c!.providerId, banned[x.s.sceneId], ctx)) continue
      ;(banned[x.s.sceneId] ??= new Set()).add(x.c!.providerId)
      varietySwaps++
      changed = true
    }
    if (!changed) break
    ;({ out, replaced, tiers } = enforceNoRepeatDeterministic(shots, results, opts, banned))
  }
  logT2v('pipeline-norepeat', 'done', { shots: shots.length, replaced, lookalikeSwaps, varietySwaps, tiers })
  return { results: out, replaced, lookalikeSwaps, varietySwaps, tiers }
}
