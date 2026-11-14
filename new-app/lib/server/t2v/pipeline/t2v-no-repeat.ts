import 'server-only'
import { t2vLlmJson } from '@/lib/server/t2v/pipeline/t2v-llm'
import { logT2v } from '@/lib/server/t2v/log'
import type { T2vDepicts, T2vLookalikeBan, T2vPickedBy, T2vPlannedShot, T2vShotResult, T2vVerifiedPick } from '@/lib/t2v/pipeline/t2v-types'

/**
 * Shot sequencing for Prompt-to-Video. HARD RULE: a shot never repeats.
 * - Never the same stock clip ID twice; never two near-identical frames (worker dHash).
 * - Same shoot counts as a repeat: same author with neighbouring IDs (e.g. 24122/24123) is never placed
 *   within two shots of each other, and is used elsewhere only when a scene has no other option.
 * - One text-only LLM pass over the reviewer's descriptions catches look-alikes from different clips and
 *   adjacent scenes that are the same kind of shot (three aerial town shots in a row).
 *
 * Whether a clip fits is the reviewer's in-context score (it read the whole script). Scenes pick scarcest
 * first (fewest passing clips; ties in story order) so a line with options never takes another line's only
 * good clip. Every scene tries, in order: accepted (7+), usable (5-6), a photo (5+), a spare re-checked for
 * this line (5+), an AI clip, then a last resort that still scored FILLER_MIN_SCORE+ for this line. Nothing
 * scoring below FILLER_MIN_SCORE is ever placed. The only edit-quality rule is live action for realistic styles.
 */
const NEAR_DUP_BITS = 10
const ACCEPT_SCORE = 7
const USABLE_SCORE = 5
const SPARE_SCORE = 6
/** Model-score floor for any filler (last resort, cross-line spare): no 0-4/10 clip is ever placed. */
export const FILLER_MIN_SCORE = 5

export type T2vQualityCtx = { realistic: boolean }

/** Score cap from the literal-depiction judgement (same numbers as the worker's verify_stock.DEPICTS_CAP). */
export const DEPICTS_CAP: Record<T2vDepicts, number> = { yes: 10, partly: 6, no: 4 }

/** Spellings of the three answers (case and punctuation ignored); same table as the worker's _DEPICTS_WORDS. */
const DEPICTS_WORDS: Record<string, T2vDepicts> = {
  yes: 'yes', y: 'yes', true: 'yes',
  partly: 'partly', partially: 'partly', partial: 'partly', part: 'partly', somewhat: 'partly',
  no: 'no', n: 'no', false: 'no', not: 'no', none: 'no',
}

/** 'Partially.', 'No.', ' YES ' -> partly / no / yes; undefined when it is none of them (or empty). */
export function depictsWord(v: unknown): T2vDepicts | undefined {
  const w = String(v ?? '').toLowerCase().replace(/[^a-z]+/g, ' ').trim().split(' ')[0]
  return w ? DEPICTS_WORDS[w] : undefined
}

/** A model's depicts answer: yes / partly / no. Unknown or missing fails closed to 'no' (capped at 4). */
export function normDepicts(v: unknown): T2vDepicts {
  return depictsWord(v) ?? 'no'
}

/** The score after the depiction cap: a clip that does not literally show the line never passes on argument. */
export function capByDepicts(score: number, depicts: T2vDepicts | undefined): number {
  return depicts ? Math.min(score, DEPICTS_CAP[depicts]) : score
}

/** Edit-quality rule only: live action for realistic styles. Fit to the line and video is the model's score. */
export function t2vQualityOk(e: { style?: string }, ctx: T2vQualityCtx): boolean {
  return !(ctx.realistic && e.style && e.style !== 'live_action')
}

/** AI clip with strong content may carry the reviewer's 3d_render tag (generated look) when stock is way off. */
export const AI_RELAXED_MIN_SCORE = 8
/** ...but only when the best usable stock option for the line scores this or lower. */
export const AI_RELAXED_MAX_STOCK = 4

/**
 * An AI clip works for a line when it passes the normal check (5+, live action), or (aiBroll runs only)
 * its content scores 8+ and only the style tag fails, while the best usable stock option scores 4 or lower.
 */
export function t2vAiAcceptable(e: { score?: number; error?: string; style?: string }, ctx: T2vQualityCtx, bestStock: number): boolean {
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
 * filming the same subject (e.g. two close-ups of one object by one creator, IDs far apart).
 */
export function sameShoot(a: ClipRef, b: ClipRef): boolean {
  if (a.providerId === b.providerId) return true
  if (!a.author || a.author !== b.author || (a.provider ?? 'pixabay') !== (b.provider ?? 'pixabay')) return false
  if (similarSubject(a.subject, b.subject)) return true
  const x = Number(a.providerId)
  const y = Number(b.providerId)
  return Number.isFinite(x) && Number.isFinite(y) && Math.abs(x - y) <= SAME_SHOOT_ID_GAP
}

/**
 * Sibling clips of a banned look-alike (QA F4: bans matched the exact id only): same author AND the same shot
 * again - a near-identical frame hash, or neighbouring ids with the same subject, framing and action. The clip it
 * was banned against (`of`) is never its own sibling. Cheap and generic (reviewer fields only).
 */
export function lookalikeSiblings(ban: { providerId: string; of: string }, all: Array<FreeClipLike>): string[] {
  const src = all.find((e) => e.providerId === ban.providerId)
  if (!src?.author) return []
  const out = new Set<string>()
  for (const e of all) {
    if (e.providerId === ban.providerId || e.providerId === ban.of || out.has(e.providerId)) continue
    if (e.author !== src.author || (e.provider ?? 'pixabay') !== (src.provider ?? 'pixabay')) continue
    const x = Number(e.providerId)
    const y = Number(src.providerId)
    const nearId = Number.isFinite(x) && Number.isFinite(y) && Math.abs(x - y) <= SAME_SHOOT_ID_GAP
    if (nearDuplicateHash(e.phash, src.phash) || (nearId && nearIdenticalShot(e, src))) out.add(e.providerId)
  }
  return [...out]
}
type FreeClipLike = ClipRef & { phash?: string[]; framing?: string; action?: string; visible?: string }

/** At most this many still photos in a row (photos with motion are a fallback, not the look of the edit). */
export const MAX_CONSECUTIVE_STILLS = 2

/**
 * Near-identical neighbours: the same subject in the same framing doing the same thing (the same object
 * falling twice in a row; two close-ups of the same thing). Different framing or action is fine.
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
/** Photos and video clips the worker's motion check found static (a frozen frame reads as a still). */
const isStill = (e: { kind?: string; static?: boolean }) => e.kind === 'photo' || e.static === true
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
    // The reviewer's words travel with every placed pick (photos and re-picked clips included).
    subjectVisible: e.subjectVisible,
    fitReason: e.fitReason ?? '',
    seen: e.seen ?? e.visible ?? '',
    lineShows: e.lineShows,
    depicts: e.depicts,
    rawScore: e.rawScore,
    static: e.static,
    motion: e.motion,
    fitReasonFrom: 'verify',
    verdict,
  }
}

/**
 * A clip placed under a line it was not visually verified for: EVERY stored judgement field comes from the
 * re-check against the placed line (QA (b)/S2: sleep sh20 and snow sh6 kept the original line's depicts,
 * rawScore and lineShows while score and reason came from the re-check). `seen` stays the reviewer's description
 * of the clip (the text re-check does not look at it again).
 */
export function borrowedPick(e: Ev, lineScore: number, reason: string, j: SpareJudgement | undefined, shot: T2vPlannedShot): T2vVerifiedPick {
  const depicts = j?.depicts ?? 'no'
  return {
    ...toPick(e, 'weak_match'),
    score: lineScore,
    rawScore: j?.rawScore ?? lineScore,
    depicts,
    lineShows: j?.lineShows || shot.lineShows || shot.intent,
    lineShowsFixed: true,
    matches: lineScore >= ACCEPT_SCORE && depicts === 'yes',
    reviewedForOtherLine: e.score,
    fitReason: reason,
    fitReasonFrom: 'line_recheck',
  }
}

/** Relevance first (the reviewer's in-context score); readability only breaks near-ties. */
function rank(e: Ev): number {
  return (e.score ?? 0) + 0.1 * (e.lighting ?? 5) + (e.matches ? 1 : 0)
}

/**
 * Literal-depiction order: yes > (not judged: older answers) > partly > no. Selection ranks this BEFORE the
 * score, so a clip that plainly shows the line (e.g. one a reimagine idea found) beats a stretched one that
 * also "passed" (sleep sh13/sh17: thermostat / fan / open window lost to a candlelit-reading pick at 8-10).
 */
export function depictsRank(e: { depicts?: T2vDepicts }): number {
  return e.depicts === 'yes' ? 3 : e.depicts === 'partly' ? 1 : e.depicts === 'no' ? 0 : 2
}

/** Selection order for one line's clips: depiction first, then score (readability breaks near-ties). */
export function pickOrder(a: Ev, b: Ev): number {
  return depictsRank(b) - depictsRank(a) || rank(b) - rank(a)
}

/**
 * Incumbent rule (QA V3): on a rerun the previous run's placed pick (re-verified this run) stays unless a new clip
 * is CLEARLY better: a higher depiction rank, or the same rank and at least +2 score. #1190's sleep sh12 charging
 * clip was lost two runs in a row to equal-looking newcomers.
 */
export const INCUMBENT_MARGIN = 2
export function clearlyBetter(a: Ev, inc: Ev): boolean {
  const dr = depictsRank(a) - depictsRank(inc)
  return dr > 0 || (dr === 0 && (a.score ?? 0) >= (inc.score ?? 0) + INCUMBENT_MARGIN)
}

/** pickOrder, then the incumbent moves to the front unless the leader clearly beats it. */
export function withIncumbentFirst<T extends Ev>(sorted: T[]): T[] {
  const inc = sorted.find((e) => e.incumbent)
  if (!inc || sorted[0] === inc || clearlyBetter(sorted[0]!, inc)) return sorted
  return [inc, ...sorted.filter((e) => e !== inc)]
}

/** Best score among usable (quality-ok, placeable) stock clips and photos for one line; -1 when none. */
export function bestStockScore(r: T2vShotResult | undefined, ctx: T2vQualityCtx, placeable: (e: Ev) => boolean = () => true): number {
  let best = -1
  for (const e of r?.evaluated ?? []) if (!isAi(e) && !e.error && typeof e.score === 'number' && placeable(e) && t2vQualityOk(e, ctx)) best = Math.max(best, e.score)
  return best
}

export type NoRepeatPick = { sceneId: string; tier: string }

/** A clip that passed review (accepted tier) for a line but is not on screen there, and why. */
export type UnusedPassing = { sceneId: string; providerId: string; score: number; reason: string }

/** Own clips that pass for this line (accepted tier: 7+, matches, live action). */
function passingCount(r: T2vShotResult | undefined, ctx: T2vQualityCtx): number {
  return (r?.evaluated ?? []).filter((e) => !isAi(e) && scored(e, ACCEPT_SCORE) && Boolean(e.matches) && t2vQualityOk(e, ctx)).length
}

/** Story indexes, scarcest first: fewest passing clips, ties in story order. */
export function scarcityOrder(shots: T2vPlannedShot[], results: Record<string, T2vShotResult>, ctx: T2vQualityCtx): number[] {
  const n = shots.map((s) => passingCount(results[s.sceneId], ctx))
  return shots.map((_, i) => i).sort((a, b) => n[a]! - n[b]! || a - b)
}

type FreeClip = ClipRef & { phash?: string[]; kind?: string; framing?: string; action?: string; visible?: string }

/** Deterministic pass (scarcest scenes first): unique IDs, no dHash look-alikes, same-shoot rules, tiered fill. */
export function enforceNoRepeatDeterministic(
  shots: T2vPlannedShot[],
  results: Record<string, T2vShotResult>,
  opts: { realistic: boolean; spareScores?: SpareScores; spareReasons?: SpareReasons; spareJudgements?: SpareJudgements },
  banned: Record<string, Set<string>> = {},
): {
  out: Record<string, T2vShotResult>
  replaced: number
  tiers: Record<string, T2vPickedBy>
  spareRequests: Record<string, Ev[]>
  banned: Record<string, Set<string>>
  unused: UnusedPassing[]
} {
  const ctx: T2vQualityCtx = { realistic: opts.realistic }
  const out: Record<string, T2vShotResult> = {}
  const tiers: Record<string, T2vPickedBy> = {}
  /** Picks by story index (neighbour rules read the shots already placed on either side). */
  const placed = new Map<number, T2vVerifiedPick>()
  const pickedBy = new Map<string, string>()
  let replaced = 0
  const spareRequests: Record<string, Ev[]> = {}
  const tierList: Tier[] = [
    { verdict: 'accepted', tier: 'accepted', ok: (e) => scored(e, ACCEPT_SCORE) && Boolean(e.matches) && t2vQualityOk(e, ctx) },
    { verdict: 'weak_match', tier: 'usable', ok: (e) => scored(e, USABLE_SCORE) && t2vQualityOk(e, ctx) },
  ]
  // On-topic B-roll the reviewer rated well for some other line of this video (re-checked per line before use).
  const spares: Ev[] = []
  const seenSpare = new Set<string>()
  for (const shot of shots) {
    for (const e of results[shot.sceneId]?.evaluated ?? []) {
      if (isPhoto(e) || isAi(e) || seenSpare.has(e.providerId) || !scored(e, SPARE_SCORE) || !t2vQualityOk(e, ctx)) continue
      seenSpare.add(e.providerId)
      spares.push(e)
    }
  }
  spares.sort((a, b) => rank(b) - rank(a))

  /** Why `e` cannot go at story index i right now ('' = free). */
  const blocker = (i: number, sceneId: string, e: FreeClip, strictShoot: boolean): string => {
    if (banned[sceneId]?.has(e.providerId)) return 'banned_by_sequence_check'
    const all = [...placed.entries()]
    const same = all.find(([, p]) => p.providerId === e.providerId)
    if (same) return `used_by:${shots[same[0]]?.sceneId}`
    const dup = all.find(([, p]) => nearDuplicateHash(e.phash, p.phash))
    if (dup) return `near_duplicate_of:${shots[dup[0]]?.sceneId}`
    const near = [i - 2, i - 1, i + 1, i + 2].map((k) => placed.get(k)).filter(Boolean) as T2vVerifiedPick[]
    if (near.some((p) => sameShoot(p, e))) return 'same_shoot_as_neighbour'
    if (isStill(e)) {
      const still = (k: number) => isStill(placed.get(k) ?? {})
      if ((still(i - 2) && still(i - 1)) || (still(i - 1) && still(i + 1)) || (still(i + 1) && still(i + 2))) return 'third_still_in_a_row'
    }
    if (strictShoot && all.some(([, p]) => sameShoot(p, e))) return 'same_shoot_elsewhere'
    if (strictShoot && [placed.get(i - 1), placed.get(i + 1)].some((p) => p && nearIdenticalShot(p, e))) return 'near_identical_neighbour'
    return ''
  }

  /**
   * A clip goes to the line it fits best (QA S1, snow sh6/sh7: "Feel for drafts" took 11293 as a 5/partly spare
   * while it was a 10/yes for "seal gaps", which was then held). Another line O "claims" the clip against this
   * line when O judged it better (depiction first, then score), O has no clip of its own yet, and O has no
   * equal-or-better alternative it could still take. Generic: judgements only, no topic words.
   */
  const indexOf = new Map(shots.map((s, k) => [s.sceneId, k]))
  const claimedBy = (sceneId: string, e: FreeClip, mine: { depicts?: T2vDepicts; score?: number }): string => {
    for (const o of shots) {
      if (o.sceneId === sceneId) continue
      const k = indexOf.get(o.sceneId)!
      if (placed.get(k)) continue
      const eo = results[o.sceneId]?.evaluated.find((x) => x.providerId === e.providerId)
      if (!eo || isAi(eo) || !scored(eo, USABLE_SCORE) || !t2vQualityOk(eo, ctx)) continue
      const dr = depictsRank(eo) - depictsRank(mine)
      if (dr < 0 || (dr === 0 && (eo.score ?? 0) <= (mine.score ?? 0))) continue
      const alt = results[o.sceneId]!.evaluated.some(
        (f) => f.providerId !== e.providerId && !isAi(f) && scored(f, USABLE_SCORE) && t2vQualityOk(f, ctx) && pickOrder(f, eo) <= 0 && !blocker(k, o.sceneId, f, false),
      )
      if (!alt) return o.sceneId
    }
    return ''
  }

  for (const i of scarcityOrder(shots, results, ctx)) {
    const shot = shots[i]!
    const r = results[shot.sceneId] ?? { sceneId: shot.sceneId, chosen: null, evaluated: [] }
    // This line's own judgement of a clip: its own review, else the re-check for this line, else none.
    const mineOf = (e: FreeClip): { depicts?: T2vDepicts; score?: number } => {
      const own = r.evaluated.find((x) => x.providerId === e.providerId)
      if (own) return own
      const j = opts.spareJudgements?.[shot.sceneId]?.[e.providerId]
      return j ? { depicts: j.depicts, score: j.score } : { depicts: 'no', score: 0 }
    }
    const free = (e: FreeClip, strictShoot: boolean) => !blocker(i, shot.sceneId, e, strictShoot) && !claimedBy(shot.sceneId, e, mineOf(e))
    let chosen: T2vVerifiedPick | null = null
    let tier: T2vPickedBy | '' = ''
    // A worker best_available pick is never taken directly: only the tiers below place a clip.
    // The carried pick also yields to an own clip of the same or a higher tier that ranks above it (depiction
    // first): reimagine and photo rounds add their results without a pick, so a literal clip they found must
    // be able to replace an earlier stretched one.
    const chosenLevel = r.chosen?.verdict === 'accepted' ? 2 : 1
    const outranked = (c: T2vVerifiedPick) =>
      r.evaluated.some(
        (e) =>
          e.providerId !== c.providerId && !isAi(e) && free(e, true) && t2vQualityOk(e, ctx) &&
          (scored(e, ACCEPT_SCORE) && e.matches ? 2 : scored(e, USABLE_SCORE) ? 1 : 0) >= chosenLevel &&
          // An incumbent is outranked only by a clearly better clip; it outranks a non-incumbent pick it is not clearly worse than.
          (c.incumbent ? clearlyBetter(e, c as Ev) : e.incumbent ? !clearlyBetter(c as Ev, e) : pickOrder(e, c as Ev) < 0),
      )
    if (r.chosen && r.chosen.verdict !== 'best_available' && free(r.chosen, true) && t2vQualityOk(r.chosen, ctx) && !outranked(r.chosen)) {
      chosen = r.chosen
      tier = r.chosen.verdict === 'accepted' ? 'accepted' : 'usable'
    } else if (r.chosen) replaced++
    // Same-shoot elsewhere in the video only when the scene has no other option.
    for (const strict of [true, false]) {
      if (chosen) break
      const all = withIncumbentFirst(r.evaluated.filter((e) => free(e, strict)).sort(pickOrder))
      const alts = all.filter((e) => !isPhoto(e) && !isAi(e))
      const photos = all.filter(isPhoto)
      const ais = all.filter(isAi)
      // Video first (motion), unless a photo shows the line more literally (depiction rank above the video's).
      const literalPhoto = photos.find((e) => scored(e, USABLE_SCORE) && t2vQualityOk(e, ctx))
      for (const t of tierList) {
        const hit = alts.find(t.ok)
        if (hit && literalPhoto && depictsRank(literalPhoto) > depictsRank(hit)) break
        if (hit) {
          chosen = toPick(hit, t.verdict)
          tier = t.tier
          break
        }
      }
      if (!chosen) {
        // Photo with motion: a still judged for THIS line (5+), before spares.
        const hit = photos.find((e) => scored(e, USABLE_SCORE) && t2vQualityOk(e, ctx))
        if (hit) {
          chosen = toPick(hit, scored(hit, ACCEPT_SCORE) && hit.matches ? 'accepted' : 'weak_match')
          tier = 'photo'
        }
      }
      if (!chosen) {
        // Spare = a clip reviewed for another line. Only after it was re-checked against THIS line (5+);
        // its score becomes the score for this line, so QA judges the pick where it actually sits.
        // Its fitReason is the re-check's reason for THIS line (never the other line's verify reason); a
        // spare without one is not placed.
        const lineScores = opts.spareScores?.[shot.sceneId] ?? {}
        const lineReasons = opts.spareReasons?.[shot.sceneId]
        const hasReason = (id: string) => !opts.spareReasons || Boolean(lineReasons?.[id])
        const spare = spares.find((e) => free(e, strict) && (lineScores[e.providerId] ?? -1) >= FILLER_MIN_SCORE && hasReason(e.providerId))
        if (spare) {
          const lineScore = lineScores[spare.providerId]!
          chosen = borrowedPick(spare, lineScore, lineReasons?.[spare.providerId] ?? '', opts.spareJudgements?.[shot.sceneId]?.[spare.providerId], shot)
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
      if (!chosen && strict && !opts.spareScores) {
        const asks = spares.filter((e) => free(e, true)).slice(0, 4)
        if (asks.length) spareRequests[shot.sceneId] = asks
      }
    }
    if (!chosen) {
      // Last resort before reimagine/AI/extend-previous: an own clip the reviewer still scored
      // FILLER_MIN_SCORE+ for this line in this video, even when it fails the live-action style rule.
      const any = r.evaluated.filter((e) => !isAi(e) && free(e, false) && scored(e, FILLER_MIN_SCORE)).sort(pickOrder)[0]
      if (any) {
        chosen = toPick(any, 'best_available')
        tier = 'last_resort'
      }
    }
    if (chosen) {
      placed.set(i, chosen)
      pickedBy.set(chosen.providerId, shot.sceneId)
    }
    if (tier) tiers[shot.sceneId] = tier
    out[shot.sceneId] = { ...r, chosen }
  }
  // Why each passing clip is not on screen under its own line (closes "why wasn't 124252 used?").
  const unused: UnusedPassing[] = []
  shots.forEach((shot, i) => {
    const mine = out[shot.sceneId]?.chosen
    for (const e of results[shot.sceneId]?.evaluated ?? []) {
      if (isAi(e) || !scored(e, ACCEPT_SCORE) || !e.matches || !t2vQualityOk(e, ctx) || mine?.providerId === e.providerId) continue
      const other = pickedBy.get(e.providerId)
      let reason = other ? `used_by:${other}` : ''
      if (!reason) {
        const keep = placed.get(i)
        placed.delete(i)
        reason = blocker(i, shot.sceneId, e, false) || (mine ? `a_better_clip_was_picked:${mine.providerId}` : 'not_picked')
        if (keep) placed.set(i, keep)
      }
      unused.push({ sceneId: shot.sceneId, providerId: e.providerId, score: e.score ?? 0, reason })
    }
  })
  return { out, replaced, tiers, spareRequests, banned, unused }
}

export type SpareScores = Record<string, Record<string, number>>
/** The re-check's own reason per line and clip: the fitReason of a clip placed under a line it was not verified for. */
export type SpareReasons = Record<string, Record<string, string>>

export const SPARE_SYSTEM = `You re-check stock clips for a stock-footage video. Each clip was reviewed for a DIFFERENT
narration line; a reviewer described what it shows. Read the whole script first so you understand the video.
For each NEW line (read it inside its full sentence and next to its neighbouring lines) and each clip:
- lineShows (given per line, FIXED): what a viewer should see for that line. Judge against it exactly as
  written; never restate, widen or reinterpret it to fit a clip, and do not output it.
- depicts: does what the clip shows ("shows") literally show lineShows, as a viewer watching the whole video
  would see it? "yes" = it shows it; "partly" = it shows part of it, or it in a clearly different situation;
  "no" = it shows something else, even if related, symbolic or a metaphor.
- score: how well the clip works under the NEW line at that point of THIS video (0-10): 7-10 clearly works;
  5-6 usable; 0-4 does not work here. depicts "no" means 4 or lower; "partly" means 6 or lower.
- reason: one short sentence on why what it shows does or does not fit the NEW line.
Return ONLY JSON: {"scores": [{"sceneId": string, "providerId": string, "depicts": "yes"|"partly"|"no",
"score": number, "reason": string}]}`

/** One text-only call: score candidate spares against the line they would sit under. */
export async function scoreSpares(
  shots: T2vPlannedShot[],
  requests: Record<string, Ev[]>,
  context: { script?: string; videoUnderstanding?: string } = {},
): Promise<SpareScores> {
  return (await scoreSparesWithReasons(shots, requests, context)).scores
}

/** The re-check's full judgement of a clip for the line it would sit under (stored on the pick when placed). */
export type SpareJudgement = { depicts: T2vDepicts; rawScore: number; score: number; lineShows: string; reason: string }
export type SpareJudgements = Record<string, Record<string, SpareJudgement>>

/** Same re-check, also returning the re-check's reason per line and clip (fitReason for that line). */
export async function scoreSparesWithReasons(
  shots: T2vPlannedShot[],
  requests: Record<string, Ev[]>,
  context: { script?: string; videoUnderstanding?: string } = {},
): Promise<{ scores: SpareScores; reasons: SpareReasons; judgements: SpareJudgements; asked: number }> {
  const items = shots
    .filter((s) => requests[s.sceneId]?.length)
    .map((s) => ({
      sceneId: s.sceneId,
      lineNo: shots.indexOf(s) + 1,
      line: s.narration,
      ...(s.sentence && s.sentence.trim() !== s.narration.trim() ? { fullSentence: s.sentence } : {}),
      previousLine: shots[shots.indexOf(s) - 1]?.narration ?? '',
      nextLine: shots[shots.indexOf(s) + 1]?.narration ?? '',
      moment: s.moment ?? s.intent,
      // The line's fixed lineShows (the same text the visual check used); the re-check judges against it.
      lineShows: (s.lineShows || s.intent || '').trim(),
      mustRecognise: s.subject ?? s.intent,
      clips: requests[s.sceneId]!.map((e) => ({ providerId: e.providerId, shows: `${e.subject ?? ''}: ${(e.seen || e.visible || '').slice(0, 160)}`, framing: e.framing ?? '' })),
    }))
  if (!items.length) return { scores: {}, reasons: {}, judgements: {}, asked: 0 }
  // One re-check per clip and line asked: counted into the run's verifierCalls (QA S4: 88 were not counted).
  const asked = items.reduce((n, it) => n + it.clips.length, 0)
  const out = await t2vLlmJson<{ scores?: Array<{ sceneId?: string; providerId?: string; score?: unknown; reason?: unknown; line_shows?: unknown; depicts?: unknown }> }>(
    SPARE_SYSTEM,
    [
      ...(context.videoUnderstanding ? [`What this video is about: ${context.videoUnderstanding}`] : []),
      ...(context.script ? [`Whole script:\n${context.script}`] : []),
      `Lines: ${JSON.stringify(items)}`,
    ].join('\n'),
    { maxTokens: 3000 },
  )
  const res: SpareScores = {}
  const reasons: SpareReasons = {}
  const judgements: SpareJudgements = {}
  for (const r of Array.isArray(out.scores) ? out.scores : []) {
    const sc = Number(r.score)
    if (!r.sceneId || !r.providerId || !Number.isFinite(sc) || !requests[r.sceneId]?.some((e) => e.providerId === String(r.providerId))) continue
    const id = String(r.providerId)
    // Unknown or missing depicts fails closed ('no', capped at 4) and is logged.
    if (!depictsWord(r.depicts)) logT2v('pipeline-norepeat', 're-check depicts unknown', { sceneId: r.sceneId, providerId: id, depicts: String(r.depicts ?? '').slice(0, 40), treatedAs: 'no' })
    const depicts = normDepicts(r.depicts)
    const raw = Math.max(0, Math.min(10, Math.round(sc)))
    const score = capByDepicts(raw, depicts)
    ;(res[r.sceneId] ??= {})[id] = score
    let why = String(r.reason ?? '').trim().slice(0, 200)
    if (!why) {
      // No reason given: never silently drop the clip. Derive one from what it shows and the depiction call
      // (marked as derived); no second paid call.
      const e = requests[r.sceneId]!.find((x) => x.providerId === id)
      why = `(re-check gave no reason) ${depicts ? `depicts ${depicts}; ` : ''}shows: ${String(e?.seen || e?.visible || '').slice(0, 150)}`
      logT2v('pipeline-norepeat', 're-check reason derived', { sceneId: r.sceneId, providerId: id, score })
    }
    ;(reasons[r.sceneId] ??= {})[id] = why
    const lineShows = items.find((it) => it.sceneId === r.sceneId)?.lineShows ?? ''
    ;(judgements[r.sceneId] ??= {})[id] = { depicts, rawScore: raw, score, lineShows, reason: why }
    logT2v('pipeline-norepeat', 're-check', { sceneId: r.sceneId, providerId: id, lineShows: lineShows.slice(0, 80), depicts, rawScore: raw, score })
  }
  return { scores: res, reasons, judgements, asked }
}

const LOOKALIKE_SYSTEM = `You check the shot sequence of a stock-footage video for repetition. Each item is one shot,
in edit order, described by a footage reviewer.
1. "pairs": shots ANYWHERE in the list that a viewer would feel are the same shot shown twice: same main
   subject AND same framing/shot size AND similar setting (two close-ups of the same object; two aerials of
   the same kind of place; the same thing at the same location from a slightly different angle).
2. "sameKind": CONSECUTIVE shots (positions p and p+1) that are the same kind of shot, which makes the edit
   feel monotonous: e.g. one aerial after another, two static product close-ups in a row. Different shot
   kinds (aerial vs close-up of hands vs interior) are fine.
Return ONLY JSON: {"pairs": [[p, q], ...], "sameKind": [[p, p+1], ...]} using the "p" positions given.`

/** Look-alike pairs (positions) in a placed sequence: the finisher re-checks its own placements with this. */
export async function lookalikePairs(items: Array<{ p: number; still: boolean; framing: string; subject: string; visible: string }>): Promise<Array<[number, number]>> {
  const r = await sequenceCheck(items)
  return r.pairs.length ? r.pairs : r.dup.map((p) => [p, p] as [number, number])
}

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

/** Does the scene have another good (5+, live action) clip besides `exceptId`? Variety swaps only then. */
function hasGoodAlternative(r: T2vShotResult | undefined, exceptId: string, banned: Set<string> | undefined, ctx: T2vQualityCtx): boolean {
  return (r?.evaluated ?? []).some((e) => e.providerId !== exceptId && !banned?.has(e.providerId) && scored(e, USABLE_SCORE) && t2vQualityOk(e, ctx))
}

/** Best score this scene could fall back to without `exceptId` (quality-ok, not banned); -1 when none. */
function nextBestScore(r: T2vShotResult | undefined, exceptId: string, banned: Set<string> | undefined, ctx: T2vQualityCtx): number {
  let best = -1
  for (const e of r?.evaluated ?? []) {
    if (e.providerId === exceptId || banned?.has(e.providerId) || e.error || typeof e.score !== 'number') continue
    if (isAi(e) ? !t2vAiAcceptable(e, ctx, -1) : !t2vQualityOk(e, ctx)) continue
    best = Math.max(best, e.score)
  }
  return best
}

/**
 * Which position of a look-alike pair gives up its clip: the side that loses least, i.e. whose scene has
 * the better next option (a scene whose only real option is this clip, e.g. a good AI clip over 1-3 stock,
 * keeps it); then the weaker pick; then the later shot.
 */
export function dupLoser(
  x: { s: T2vPlannedShot; c?: T2vVerifiedPick | null },
  y: { s: T2vPlannedShot; c?: T2vVerifiedPick | null },
  px: number,
  py: number,
  banned: Record<string, Set<string>>,
  opts: { realistic: boolean },
  results: Record<string, T2vShotResult>,
): number {
  const next = (v: { s: T2vPlannedShot; c?: T2vVerifiedPick | null }) => {
    const ctx = { realistic: opts.realistic }
    return nextBestScore(results[v.s.sceneId], v.c!.providerId, banned[v.s.sceneId], ctx)
  }
  const nx = next(x)
  const ny = next(y)
  if (nx !== ny) return nx > ny ? px : py
  const sx = x.c?.score ?? 0
  const sy = y.c?.score ?? 0
  if (sx !== sy) return sx < sy ? px : py
  return Math.max(px, py)
}

export async function enforceNoRepeat(
  shots: T2vPlannedShot[],
  results: Record<string, T2vShotResult>,
  opts: { realistic: boolean; spareScores?: SpareScores; spareReasons?: SpareReasons; spareJudgements?: SpareJudgements; script?: string; videoUnderstanding?: string; lookalikeBans?: T2vLookalikeBan[] },
): Promise<{
  results: Record<string, T2vShotResult>
  replaced: number
  lookalikeSwaps: number
  varietySwaps: number
  tiers: Record<string, T2vPickedBy>
  /** Clips the sequence check removed per scene: the finisher's fallback must never put them back. */
  banned: Record<string, string[]>
  /** Passing clips not used under their own line, with the reason (also logged). */
  unused: UnusedPassing[]
  /** Every look-alike ban so far (carried in + found here): the caller persists it on the run. */
  lookalikeBans: T2vLookalikeBan[]
  /** Text re-checks asked in this pass (one per clip and line): the caller adds them to verifierCalls. */
  rechecks: number
}> {
  const banned: Record<string, Set<string>> = {}
  // Look-alike bans from earlier passes of this run are carried in for every line: the sequence check is a
  // model call and may not flag the same pair again (snow sh14/sh19, 44082 after the reimagine re-run).
  const lookalikeBans: T2vLookalikeBan[] = [...(opts.lookalikeBans ?? [])]
  const allEv = Object.values(results).flatMap((r) => r.evaluated ?? [])
  const banEverywhere = (b: T2vLookalikeBan) => {
    const sib = lookalikeSiblings(b, allEv)
    for (const s of shots) for (const id of [b.providerId, ...sib]) (banned[s.sceneId] ??= new Set()).add(id)
    if (sib.length) logT2v('pipeline-norepeat', 'ban siblings', { providerId: b.providerId, of: b.of, siblings: sib })
  }
  for (const b of lookalikeBans) banEverywhere(b)
  let { out, replaced, tiers, spareRequests, unused } = enforceNoRepeatDeterministic(shots, results, opts, banned)
  // Spares are re-checked against the line they would fill before any is placed.
  let spareScores: SpareScores = {}
  let spareReasons: SpareReasons = {}
  let spareJudgements: SpareJudgements = {}
  let rechecks = 0
  try {
    let asked = 0
    ;({ scores: spareScores, reasons: spareReasons, judgements: spareJudgements, asked } = await scoreSparesWithReasons(shots, spareRequests, { script: opts.script, videoUnderstanding: opts.videoUnderstanding }))
    rechecks += asked
  } catch (err) {
    logT2v('pipeline-norepeat', 'spare re-check failed (no spares used)', { error: err instanceof Error ? err.message : 'error' })
  }
  opts = { ...opts, spareScores, spareReasons, spareJudgements }
  ;({ out, replaced, tiers, unused } = enforceNoRepeatDeterministic(shots, results, opts, banned))
  let lookalikeSwaps = 0
  let varietySwaps = 0
  for (let pass = 0; pass < 3; pass++) {
    const seq = shots.map((s) => ({ s, c: out[s.sceneId]?.chosen })).filter((x) => x.c)
    // Static videos read as stills too (QA F7), for the look-alike / same-kind check.
    const items = seq.map((x, p) => ({ p, still: isStill(x.c!), framing: x.c!.framing ?? '', subject: x.c!.subject ?? '', visible: (x.c!.visible ?? '').slice(0, 160) }))
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
      // A look-alike of a clip in this video is banned for EVERY line, not just the one it lost: placed
      // elsewhere (e.g. the next line) it is still the same shot shown twice (sleep sh15/sh16, 42966).
      for (const s of shots) (banned[s.sceneId] ??= new Set()).add(z.c!.providerId)
      const o = p === a ? seq[b] : seq[a]
      if (!lookalikeBans.some((x) => x.providerId === z.c!.providerId)) {
        const ban: T2vLookalikeBan = { providerId: z.c!.providerId, of: o?.c?.providerId ?? '?', sceneId: z.s.sceneId, source: 'pick_pass', at: new Date().toISOString() }
        lookalikeBans.push(ban)
        banEverywhere(ban)
      }
      logT2v('pipeline-norepeat', 'ban', { sceneId: z.s.sceneId, providerId: z.c!.providerId, reason: `lookalike_of:${o?.s.sceneId ?? '?'}:${o?.c?.providerId ?? '?'}` })
      lookalikeSwaps++
      changed = true
    }
    for (const p of check.kind) {
      const x = seq[p]
      if (!x || dropped.has(p)) continue
      // Variety is a preference: swap only when the scene has another good clip to use.
      if (!hasGoodAlternative(out[x.s.sceneId], x.c!.providerId, banned[x.s.sceneId], { realistic: opts.realistic })) continue
      ;(banned[x.s.sceneId] ??= new Set()).add(x.c!.providerId)
      logT2v('pipeline-norepeat', 'ban', { sceneId: x.s.sceneId, providerId: x.c!.providerId, reason: `same_kind_as:${seq[p - 1]?.s.sceneId ?? '?'}` })
      varietySwaps++
      changed = true
    }
    if (!changed) break
    ;({ out, replaced, tiers, unused } = enforceNoRepeatDeterministic(shots, results, opts, banned))
  }
  logT2v('pipeline-norepeat', 'done', { shots: shots.length, replaced, lookalikeSwaps, varietySwaps, carriedBans: opts.lookalikeBans?.length ?? 0, totalBans: lookalikeBans.length, tiers })
  for (const u of unused) logT2v('pipeline-norepeat', 'passing clip unused', u)
  return {
    results: out,
    replaced,
    lookalikeSwaps,
    varietySwaps,
    tiers,
    banned: Object.fromEntries(Object.entries(banned).map(([k, v]) => [k, [...v]])),
    unused,
    lookalikeBans,
    rechecks,
  }
}
