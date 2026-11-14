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
 * them is a last resort before an empty scene (lighting still applies to last-resort picks).
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
/** Lighting rule alone (lit >= MIN_LIGHTING, not night/dark unless the line is about night). Applies to every pick. */
export function t2vLitOk(e: { lighting?: number; timeOfDay?: string; luma?: number }, ctx: Pick<T2vQualityCtx, 'nightOk'>): boolean {
  if ((e.lighting ?? 10) < MIN_LIGHTING) return false
  return ctx.nightOk || (e.timeOfDay !== 'night' && (e.luma ?? 1) >= MIN_LUMA)
}

/** AI clip with strong content may carry the reviewer's 3d_render tag (generated look) when stock is way off. */
export const AI_RELAXED_MIN_SCORE = 8
/** ...but only when the best usable stock option for the line scores this or lower. */
export const AI_RELAXED_MAX_STOCK = 4

/**
 * An AI clip works for a line when it passes the normal check (5+, live action, lit), or (aiBroll runs only)
 * its content scores 8+ and only the style tag fails, while the best usable stock option scores 4 or lower.
 */
export function t2vAiAcceptable(e: { score?: number; error?: string; style?: string; lighting?: number; timeOfDay?: string; luma?: number; saturation?: number }, ctx: T2vQualityCtx, bestStock: number): boolean {
  if (e.error || typeof e.score !== 'number') return false
  if (e.score >= 5 && t2vQualityOk(e, ctx)) return true
  return e.score >= AI_RELAXED_MIN_SCORE && bestStock <= AI_RELAXED_MAX_STOCK && t2vQualityOk({ ...e, style: 'live_action' }, ctx)
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

type ClipRef = { provider?: string; providerId: string; author?: string; subject?: string }

const SUBJECT_STOP = new Set(['a', 'an', 'the', 'of', 'on', 'in', 'with', 'and', 'being', 'some', 'into', 'at', 'close', 'up', 'shot'])
function subjectWords(t: string | undefined): Set<string> {
  return new Set(
    (t ?? '')
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 1 && !SUBJECT_STOP.has(w))
      .map((w) => w.replace(/s$/, '')),
  )
}

/** Reviewer subjects overlap enough to read as the same thing (Jaccard >= 0.5 on content words). */
export function similarSubject(a: string | undefined, b: string | undefined): boolean {
  const x = subjectWords(a)
  const y = subjectWords(b)
  if (!x.size || !y.size) return false
  let inter = 0
  for (const w of x) if (y.has(w)) inter++
  return inter / (x.size + y.size - inter) >= 0.5
}

/**
 * Same shoot = a near-repeat for spacing: same clip, or same author with neighbouring IDs, or same author
 * filming the same subject (e.g. two roasted-bean close-ups by one creator, IDs far apart).
 */
export function sameShoot(a: ClipRef, b: ClipRef): boolean {
  if (a.providerId === b.providerId) return true
  if (!a.author || a.author !== b.author || (a.provider ?? 'pixabay') !== (b.provider ?? 'pixabay')) return false
  if (similarSubject(a.subject, b.subject)) return true
  const x = Number(a.providerId)
  const y = Number(b.providerId)
  return Number.isFinite(x) && Number.isFinite(y) && Math.abs(x - y) <= SAME_SHOOT_ID_GAP
}

/** At most this many still photos in a row (photos with motion are a fallback, not the look of the edit). */
export const MAX_CONSECUTIVE_STILLS = 2

/**
 * Near-identical neighbours: the same subject in the same framing doing the same thing (falling roasted
 * beans twice in a row; two close-ups of cherries on a branch). Different framing or action is fine.
 */
export function nearIdenticalShot(
  a: { subject?: string; framing?: string; action?: string; visible?: string },
  b: { subject?: string; framing?: string; action?: string; visible?: string },
): boolean {
  if (!similarSubject(a.subject, b.subject)) return false
  const fa = String(a.framing ?? '').toLowerCase()
  const fb = String(b.framing ?? '').toLowerCase()
  if (fa && fb && fa !== fb) return false
  const aa = a.action || a.visible
  const ab = b.action || b.visible
  return !aa || !ab || similarSubject(aa, ab) || subjectOverlap(aa, ab) >= 0.34
}

function subjectOverlap(a: string, b: string): number {
  const x = subjectWords(a)
  const y = subjectWords(b)
  if (!x.size || !y.size) return 0
  let inter = 0
  for (const w of x) if (y.has(w)) inter++
  return inter / (x.size + y.size - inter)
}

type Ev = T2vShotResult['evaluated'][number]
type Tier = { verdict: T2vVerifiedPick['verdict']; tier: T2vPickedBy; ok: (e: Ev) => boolean }

const isPhoto = (e: { kind?: string }) => e.kind === 'photo'
/** AI B-roll test clips: only after every stock option that truly works, never as a spare or fallback. */
const isAi = (e: { kind?: string }) => e.kind === 'ai'

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
    ...(e.kind === 'photo' || e.kind === 'ai' ? { kind: e.kind } : {}),
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

/** Best score among usable (quality-ok, placeable) stock clips and photos for one line; -1 when none. */
export function bestStockScore(r: T2vShotResult | undefined, ctx: T2vQualityCtx, placeable: (e: Ev) => boolean = () => true): number {
  let best = -1
  for (const e of r?.evaluated ?? []) if (!isAi(e) && !e.error && typeof e.score === 'number' && placeable(e) && t2vQualityOk(e, ctx)) best = Math.max(best, e.score)
  return best
}

export type NoRepeatPick = { sceneId: string; tier: string }

/** Deterministic pass (story order): unique IDs, no dHash look-alikes, same-shoot rules, tiered fill. */
export function enforceNoRepeatDeterministic(
  shots: T2vPlannedShot[],
  results: Record<string, T2vShotResult>,
  opts: { realistic: boolean; monoOk?: boolean; spareScores?: SpareScores },
  banned: Record<string, Set<string>> = {},
): { out: Record<string, T2vShotResult>; replaced: number; tiers: Record<string, T2vPickedBy>; spareRequests: Record<string, Ev[]>; banned: Record<string, Set<string>> } {
  const ctxFor = (shot: T2vPlannedShot): T2vQualityCtx => ({
    realistic: opts.realistic,
    nightOk: t2vNightLine(shot.narration, shot.intent),
    monoOk: Boolean(opts.monoOk),
  })
  const out: Record<string, T2vShotResult> = {}
  const tiers: Record<string, T2vPickedBy> = {}
  const picked: T2vVerifiedPick[] = []
  let replaced = 0
  const spareRequests: Record<string, Ev[]> = {}
  const tierList = (ctx: T2vQualityCtx): Tier[] => [
    { verdict: 'accepted', tier: 'accepted', ok: (e) => scored(e, ACCEPT_SCORE) && Boolean(e.matches) && t2vQualityOk(e, ctx) },
    { verdict: 'weak_match', tier: 'usable', ok: (e) => scored(e, USABLE_SCORE) && t2vQualityOk(e, ctx) },
  ]
  const fallbackTier = (ctx: T2vQualityCtx): Tier => ({ verdict: 'best_available', tier: 'fallback', ok: (e) => scored(e, LOOSE_SCORE) && t2vQualityOk(e, ctx) })
  // On-topic B-roll the reviewer rated well for some other line of this video (quality re-checked per line).
  const spares: Ev[] = []
  const seenSpare = new Set<string>()
  for (const shot of shots) {
    for (const e of results[shot.sceneId]?.evaluated ?? []) {
      if (isPhoto(e) || isAi(e) || seenSpare.has(e.providerId) || !scored(e, SPARE_SCORE) || !t2vQualityOk(e, { realistic: opts.realistic, nightOk: true, monoOk: true })) continue
      seenSpare.add(e.providerId)
      spares.push(e)
    }
  }
  spares.sort((a, b) => rank(b) - rank(a))

  for (const shot of shots) {
    const r = results[shot.sceneId] ?? { sceneId: shot.sceneId, chosen: null, evaluated: [] }
    const ctx = ctxFor(shot)
    const last2 = picked.slice(-2)
    const prevPick = picked[picked.length - 1]
    const stillsRun = last2.length === MAX_CONSECUTIVE_STILLS && last2.every((p) => isPhoto(p))
    const free = (e: ClipRef & { phash?: string[]; kind?: string; framing?: string; action?: string; visible?: string }, strictShoot: boolean) =>
      !banned[shot.sceneId]?.has(e.providerId) &&
      !picked.some((p) => p.providerId === e.providerId) &&
      !picked.some((p) => nearDuplicateHash(e.phash, p.phash)) &&
      !last2.some((p) => sameShoot(p, e)) &&
      !(stillsRun && isPhoto(e)) &&
      (!strictShoot || !picked.some((p) => sameShoot(p, e))) &&
      (!strictShoot || !prevPick || !nearIdenticalShot(prevPick, e))
    let chosen: T2vVerifiedPick | null = null
    let tier: T2vPickedBy | '' = ''
    // A worker fallback (3-4) is not taken directly: a re-checked spare (5+ for THIS line) beats it.
    if (r.chosen && r.chosen.verdict !== 'best_available' && free(r.chosen, true) && t2vQualityOk(r.chosen, ctx)) {
      chosen = r.chosen
      tier = r.chosen.verdict === 'accepted' ? 'accepted' : r.chosen.verdict === 'weak_match' ? 'usable' : 'fallback'
    } else if (r.chosen) replaced++
    // Same-shoot elsewhere in the video only when the scene has no other option.
    for (const strict of [true, false]) {
      if (chosen) break
      const all = r.evaluated.filter((e) => free(e, strict)).sort((a, b) => rank(b) - rank(a))
      const alts = all.filter((e) => !isPhoto(e) && !isAi(e))
      const photos = all.filter(isPhoto)
      const ais = all.filter(isAi)
      for (const t of tierList(ctx)) {
        const hit = alts.find(t.ok)
        if (hit) {
          chosen = toPick(hit, t.verdict)
          tier = t.tier
          break
        }
      }
      if (!chosen) {
        // Photo with motion: a still checked against THIS line (same subject rule, 5+), before spares.
        const hit = photos.find((e) => scored(e, USABLE_SCORE) && t2vQualityOk(e, ctx))
        if (hit) {
          chosen = toPick(hit, scored(hit, ACCEPT_SCORE) && hit.matches ? 'accepted' : 'weak_match')
          tier = 'photo'
        }
      }
      if (!chosen) {
        // Spare = a clip reviewed for another line. Only after it was re-checked against THIS line (5+);
        // its score becomes the score for this line, so QA judges the pick where it actually sits.
        const lineScores = opts.spareScores?.[shot.sceneId] ?? {}
        const spare = spares.find((e) => free(e, strict) && t2vQualityOk(e, ctx) && (lineScores[e.providerId] ?? -1) >= USABLE_SCORE)
        if (spare) {
          const lineScore = lineScores[spare.providerId]!
          chosen = { ...toPick(spare, 'weak_match'), score: lineScore, matches: lineScore >= ACCEPT_SCORE, reviewedForOtherLine: spare.score }
          tier = 'spare'
        }
      }
      if (!chosen) {
        // AI test clip: stock was way off; the generated clip passed the same check for THIS line (5+).
        // Relaxed (content 8+, style tag only) when the best usable stock option for the line is 4 or lower.
        const bestStock = bestStockScore(r, ctx, (e) => free(e, false))
        const hit = ais.find((e) => t2vAiAcceptable(e, ctx, bestStock))
        if (hit) {
          chosen = toPick(hit, scored(hit, ACCEPT_SCORE) && hit.matches ? 'accepted' : 'weak_match')
          tier = 'ai'
        }
      }
      if (!chosen) {
        const hit = alts.find(fallbackTier(ctx).ok) ?? photos.find(fallbackTier(ctx).ok)
        if (hit) {
          chosen = toPick(hit, 'best_available')
          tier = 'fallback'
        }
      }
      if (!chosen || tier === 'fallback') {
        if (strict && !opts.spareScores) {
          const asks = spares.filter((e) => free(e, true) && t2vQualityOk(e, ctx)).slice(0, 4)
          if (asks.length) spareRequests[shot.sceneId] = asks
        }
      }
    }
    if (!chosen) {
      // Last resort before an empty scene: any loosely on-topic clip, even stylised, but lit (a dim clip
      // goes to the finisher, which prefers a brighter related clip or photo and uses dim only at the end).
      const any = r.evaluated.filter((e) => !isAi(e) && free(e, false) && scored(e, LOOSE_SCORE) && t2vLitOk(e, ctx)).sort((a, b) => rank(b) - rank(a))[0]
      if (any) {
        chosen = toPick(any, 'best_available')
        tier = 'last_resort'
      }
    }
    if (chosen) picked.push(chosen)
    if (tier) tiers[shot.sceneId] = tier
    out[shot.sceneId] = { ...r, chosen }
  }
  return { out, replaced, tiers, spareRequests, banned }
}

export type SpareScores = Record<string, Record<string, number>>

const SPARE_SYSTEM = `You re-check stock clips for a stock-footage video. Each clip was reviewed for a DIFFERENT
narration line; a reviewer described what it shows. Score how well it works under the NEW line given (0-10):
7-10 clearly works; 5-6 usable; 0-4 does not work. SUBJECT RULE: the clip must show the specific subject the
line needs (coffee cherries, not any fruit; a roaster drum, not any machine). Right action, wrong subject = 0-2.
A mug of coffee does not illustrate harvesting, processing or roasting.
Return ONLY JSON: {"scores": [{"sceneId": string, "providerId": string, "score": number}]}`

/** One text-only call: score candidate spares against the line they would sit under. */
export async function scoreSpares(
  shots: T2vPlannedShot[],
  requests: Record<string, Ev[]>,
): Promise<SpareScores> {
  const items = shots
    .filter((s) => requests[s.sceneId]?.length)
    .map((s) => ({
      sceneId: s.sceneId,
      line: s.narration,
      subject: s.subject ?? s.intent,
      clips: requests[s.sceneId]!.map((e) => ({ providerId: e.providerId, shows: `${e.subject ?? ''}: ${(e.visible ?? '').slice(0, 160)}`, framing: e.framing ?? '' })),
    }))
  if (!items.length) return {}
  const out = await t2vLlmJson<{ scores?: Array<{ sceneId?: string; providerId?: string; score?: unknown }> }>(SPARE_SYSTEM, `Lines: ${JSON.stringify(items)}`, { maxTokens: 3000 })
  const res: SpareScores = {}
  for (const r of Array.isArray(out.scores) ? out.scores : []) {
    const sc = Number(r.score)
    if (!r.sceneId || !r.providerId || !Number.isFinite(sc) || !requests[r.sceneId]?.some((e) => e.providerId === String(r.providerId))) continue
    ;(res[r.sceneId] ??= {})[String(r.providerId)] = Math.max(0, Math.min(10, Math.round(sc)))
  }
  return res
}

const LOOKALIKE_SYSTEM = `You check the shot sequence of a stock-footage video for repetition. Each item is one shot,
in edit order, described by a footage reviewer.
1. "pairs": shots ANYWHERE in the list that a viewer would feel are the same shot shown twice: same main
   subject AND same framing/shot size AND similar setting (two close-ups of a charging plug; two aerials of
   the same kind of town; the same car at the same location from a slightly different angle; roasted beans
   falling onto a pile twice; two close-ups of coffee cherries on a branch).
2. "sameKind": CONSECUTIVE shots (positions p and p+1) that are the same kind of shot, which makes the edit
   feel monotonous: e.g. aerial town after aerial highway, traffic street after traffic highway, two static
   product close-ups in a row, falling beans then pouring beans, a cherry-branch close-up after another
   cherry-branch close-up. Different shot kinds (aerial vs close-up of hands vs interior) are fine.
Return ONLY JSON: {"pairs": [[p, q], ...], "sameKind": [[p, p+1], ...]} using the "p" positions given.`

async function sequenceCheck(items: Array<{ p: number; still: boolean; framing: string; subject: string; visible: string }>): Promise<{ dup: number[]; kind: number[]; pairs: Array<[number, number]> }> {
  if (items.length < 2) return { dup: [], kind: [], pairs: [] }
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
  const pairs: Array<[number, number]> = []
  for (const p of Array.isArray(out.pairs) ? out.pairs : []) {
    if (!Array.isArray(p) || p.length !== 2) continue
    const [a, b] = p.map(Number)
    if (Number.isInteger(a) && Number.isInteger(b) && a !== b) pairs.push([Math.min(a!, b!), Math.max(a!, b!)])
  }
  return { dup: later(out.pairs, false), kind: later(out.sameKind, true), pairs }
}

/** Does the scene have another good (5+, live, lit) clip besides `exceptId`? Variety swaps only then. */
function hasGoodAlternative(r: T2vShotResult | undefined, exceptId: string, banned: Set<string> | undefined, ctx: T2vQualityCtx): boolean {
  return (r?.evaluated ?? []).some((e) => e.providerId !== exceptId && !banned?.has(e.providerId) && scored(e, USABLE_SCORE) && t2vQualityOk(e, ctx))
}

/** Which position of a look-alike pair gives up its clip (see enforceNoRepeat). */
export function dupLoser(
  x: { s: T2vPlannedShot; c?: T2vVerifiedPick | null },
  y: { s: T2vPlannedShot; c?: T2vVerifiedPick | null },
  px: number,
  py: number,
  banned: Record<string, Set<string>>,
  opts: { realistic: boolean; monoOk?: boolean },
  results: Record<string, T2vShotResult>,
): number {
  const alt = (v: { s: T2vPlannedShot; c?: T2vVerifiedPick | null }) => {
    const ctx = { realistic: opts.realistic, nightOk: t2vNightLine(v.s.narration, v.s.intent), monoOk: Boolean(opts.monoOk) }
    return hasGoodAlternative(results[v.s.sceneId], v.c!.providerId, banned[v.s.sceneId], ctx)
  }
  const ax = alt(x)
  const ay = alt(y)
  if (ax !== ay) return ax ? px : py
  const sx = x.c?.score ?? 0
  const sy = y.c?.score ?? 0
  if (sx !== sy) return sx < sy ? px : py
  return Math.max(px, py)
}
export async function enforceNoRepeat(
  shots: T2vPlannedShot[],
  results: Record<string, T2vShotResult>,
  opts: { realistic: boolean; monoOk?: boolean; spareScores?: SpareScores },
): Promise<{
  results: Record<string, T2vShotResult>
  replaced: number
  lookalikeSwaps: number
  varietySwaps: number
  tiers: Record<string, T2vPickedBy>
  /** Clips the sequence check removed per scene: the finisher's fallback must never put them back. */
  banned: Record<string, string[]>
}> {
  const banned: Record<string, Set<string>> = {}
  let { out, replaced, tiers, spareRequests } = enforceNoRepeatDeterministic(shots, results, opts, banned)
  // Spares are re-checked against the line they would fill before any is placed.
  let spareScores: SpareScores = {}
  try {
    spareScores = await scoreSpares(shots, spareRequests)
  } catch (err) {
    logT2v('pipeline-norepeat', 'spare re-check failed (no spares used)', { error: err instanceof Error ? err.message : 'error' })
  }
  opts = { ...opts, spareScores }
  ;({ out, replaced, tiers } = enforceNoRepeatDeterministic(shots, results, opts, banned))
  let lookalikeSwaps = 0
  let varietySwaps = 0
  for (let pass = 0; pass < 3; pass++) {
    const seq = shots.map((s) => ({ s, c: out[s.sceneId]?.chosen })).filter((x) => x.c)
    const items = seq.map((x, p) => ({ p, still: isPhoto(x.c!), framing: x.c!.framing ?? '', subject: x.c!.subject ?? '', visible: (x.c!.visible ?? '').slice(0, 160) }))
    let check: { dup: number[]; kind: number[]; pairs: Array<[number, number]> }
    try {
      check = await sequenceCheck(items)
    } catch (err) {
      logT2v('pipeline-norepeat', 'sequence check failed (deterministic pass still applied)', { error: err instanceof Error ? err.message : 'error' })
      break
    }
    let changed = false
    // A look-alike pair loses ONE of its two shots: the side whose scene has another good clip; when
    // neither has, the weaker pick (a good AI clip or strong stock never yields to a weaker twin).
    const dropped = new Set<number>()
    for (const [a, b] of check.pairs.length ? check.pairs : check.dup.map((p) => [p, p] as [number, number])) {
      const x = seq[a]
      const y = seq[b]
      if (!x || !y || dropped.has(a) || dropped.has(b)) continue
      const p = a === b ? a : dupLoser(x, y, a, b, banned, opts, results)
      dropped.add(p)
      const z = seq[p]!
      ;(banned[z.s.sceneId] ??= new Set()).add(z.c!.providerId)
      lookalikeSwaps++
      changed = true
    }
    for (const p of check.kind) {
      const x = seq[p]
      if (!x || dropped.has(p)) continue
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
  return {
    results: out,
    replaced,
    lookalikeSwaps,
    varietySwaps,
    tiers,
    banned: Object.fromEntries(Object.entries(banned).map(([k, v]) => [k, [...v]])),
  }
}
