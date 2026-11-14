import 'server-only'
import { bestStockScore, FILLER_MIN_SCORE, nearDuplicateHash, nearIdenticalShot, scoreSpares, t2vAiAcceptable, t2vQualityOk } from '@/lib/server/t2v/pipeline/t2v-no-repeat'
import { compactScript } from '@/lib/server/t2v/pipeline/t2v-reimagine'
import { t2vRealisticStyle } from '@/lib/t2v/pipeline/t2v-types'
import { ensureT2vStockAsset } from '@/lib/server/t2v/stock-asset'
import type { StockCandidate } from '@/lib/server/t2v/stock-match'
import { logT2v } from '@/lib/server/t2v/log'
import type { T2vDraftV1, T2vKenBurns, T2vScene, T2vSceneMedia } from '@/lib/t2v/types'
import type {
  T2vFootageCandidate,
  T2vVerifiedPick,
  T2vNarrationSegment,
  T2vPipelineRun,
  T2vPickedBy,
  T2vPlannedShot,
  T2vShotResult,
  T2vStoryPlan,
} from '@/lib/t2v/pipeline/t2v-types'

const TITLE_CARD_COLOR = '#0f1115'

function stockCandidateFrom(c: T2vFootageCandidate): StockCandidate {
  return {
    provider: c.provider,
    providerId: c.providerId,
    width: c.width,
    height: c.height,
    durationS: c.durationS,
    thumbUrl: c.thumbUrl,
    previewUrl: c.previewUrl,
    srcUrl: c.srcUrl,
    pageUrl: c.pageUrl,
    author: c.author,
    tags: c.tags,
    score: 0,
    ...(c.kind === 'photo' ? { stockKind: 'photo' as const } : {}),
  }
}

/** Ken Burns moves for photo shots, cycled so consecutive stills never move the same way. */
export const PHOTO_MOVES: T2vKenBurns[] = ['zoom_in', 'pan_right', 'zoom_out', 'pan_left']

async function mapLimit<T, R>(items: T[], limit: number, fn: (t: T, i: number) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length)
  let next = 0
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++
        out[i] = await fn(items[i]!, i)
      }
    }),
  )
  return out
}

function titleCard(): T2vSceneMedia {
  return { provider: 'color', kind: 'color', color: TITLE_CARD_COLOR }
}

type Ev = T2vShotResult['evaluated'][number]

function evToPick(e: Ev): T2vVerifiedPick {
  return {
    ...e,
    provider: e.provider ?? 'pixabay',
    providerId: e.providerId,
    visible: e.visible ?? '',
    matches: Boolean(e.matches),
    score: e.score ?? 0,
    inS: e.inS ?? 0,
    outS: e.outS ?? 0,
    clipS: e.clipS ?? 0,
    verdict: 'best_available',
  } as T2vVerifiedPick
}

/**
 * Finisher: turns verified shots into a real T2V draft edit (the same document the storyboard
 * editor, T2V_ASSEMBLE worker and composition export already understand).
 * - every shot (every split piece too) gets its own distinct reviewed clip or photo: no-repeat pick → a good
 *   AI clip → an unused own clip the reviewer scored FILLER_MIN_SCORE+ for this line → the best clips
 *   reviewed for other lines, re-checked for THIS line in one text call (FILLER_MIN_SCORE+). Nothing scoring
 *   below the floor is placed: with no option left the line extends the previous shot.
 * - verified stock clip trimmed to the reviewer's in-point; audio is never used (-an in assemble)
 * - hard cuts inside a segment, dissolves between segments; no text cards (no opening title, no end card)
 */
export async function t2vFinisher(input: {
  workspaceId: string
  doc: T2vDraftV1
  run: T2vPipelineRun
  story: T2vStoryPlan
  segments: T2vNarrationSegment[]
  shots: T2vPlannedShot[]
  results: T2vShotResult[]
  candidates: Record<string, T2vFootageCandidate[]>
  /** Clips the sequence check removed per scene (never re-placed there). */
  banned?: Record<string, string[]>
}): Promise<{ scenes: T2vScene[]; results: T2vShotResult[] }> {
  const byScene = new Map(input.results.map((r) => [r.sceneId, r]))
  const used = new Set(input.results.map((r) => r.chosen?.providerId).filter(Boolean) as string[])
  const usedHashes = input.results.map((r) => r.chosen?.phash).filter((h): h is string[] => Boolean(h?.length))
  const qctx = { realistic: t2vRealisticStyle(input.run.style) }
  const hasCandidate = (id: string) => Object.values(input.candidates).some((l) => l.some((c) => c.providerId === id))
  const allEvaluated = input.results.flatMap((r) => r.evaluated ?? [])
  // Ordered options per shot without a pick (first = placed; the rest only if ingest fails).
  // Phase 1 gives every line its own related fallback first; phase 2 lends other lines' footage.
  const options = new Map<string, Array<{ pick: T2vVerifiedPick; tier: T2vPickedBy }>>()
  const open = input.shots.filter((shot) => !byScene.get(shot.sceneId)?.chosen)
  const okFor = (shot: T2vPlannedShot) => {
    const banned = new Set(input.banned?.[shot.sceneId] ?? [])
    return (e: Ev) =>
      !e.error && e.kind !== 'ai' && !used.has(e.providerId) && !banned.has(e.providerId) && hasCandidate(e.providerId) && !usedHashes.some((h) => nearDuplicateHash(e.phash, h))
  }
  // Sequence rules hold for fallbacks too: at most 2 stills in a row, no near-identical neighbours.
  const pickAt = (i: number) => {
    const sh = input.shots[i]
    return sh ? (byScene.get(sh.sceneId)?.chosen ?? options.get(sh.sceneId)?.[0]?.pick) : undefined
  }
  const seqOk = (shot: T2vPlannedShot, p: T2vVerifiedPick) => {
    const i = input.shots.indexOf(shot)
    const [b, a, n] = [pickAt(i - 2), pickAt(i - 1), pickAt(i + 1)]
    const still = (x?: T2vVerifiedPick) => x?.kind === 'photo'
    if (still(p) && still(a) && (still(b) || still(n))) return false
    return !(a && nearIdenticalShot(a, p)) && !(n && nearIdenticalShot(n, p))
  }
  const take = (shot: T2vPlannedShot, raw: Array<{ pick: T2vVerifiedPick; tier: T2vPickedBy }>) => {
    const list = [...raw.filter((o) => seqOk(shot, o.pick)), ...raw.filter((o) => !seqOk(shot, o.pick))]
    options.set(shot.sceneId, list)
    const top = list[0]
    if (top) {
      used.add(top.pick.providerId)
      if (top.pick.phash?.length) usedHashes.push(top.pick.phash)
    }
  }
  for (const shot of open) {
    const ok = okFor(shot)
    const q = (e: Ev) => Number(t2vQualityOk(e, qctx))
    const r = byScene.get(shot.sceneId)
    const list: Array<{ pick: T2vVerifiedPick; tier: T2vPickedBy }> = []
    // 0) A good AI clip for this line (same acceptance as the no-repeat pass) beats any filler.
    const banned = new Set(input.banned?.[shot.sceneId] ?? [])
    const bestStock = bestStockScore(r, qctx, (e) => !used.has(e.providerId))
    for (const e of (r?.evaluated ?? []).filter((e) => e.kind === 'ai' && !used.has(e.providerId) && !banned.has(e.providerId) && hasCandidate(e.providerId) && t2vAiAcceptable(e, qctx, bestStock)))
      list.push({ pick: evToPick(e), tier: 'ai' })
    // 1) An unused own clip the reviewer scored FILLER_MIN_SCORE+ for THIS line (live action first).
    const own = (r?.evaluated ?? []).filter((e) => ok(e) && (e.score ?? 0) >= FILLER_MIN_SCORE).sort((a, b) => q(b) - q(a) || (b.score ?? 0) - (a.score ?? 0))
    for (const e of own) list.push({ pick: evToPick(e), tier: 'fallback' })
    if (list.length) take(shot, list)
  }
  // 2) Clips reviewed for other lines: the top 8 by reviewer score, then ONE text-only re-check (whole script,
  // this line's moment) scores each against the line it would sit under. Only FILLER_MIN_SCORE+ is placed.
  const shortlist: Record<string, Ev[]> = {}
  for (const shot of open) {
    if (options.get(shot.sceneId)?.length) continue
    const ok = okFor(shot)
    const seen = new Set<string>()
    shortlist[shot.sceneId] = allEvaluated
      .filter((e) => ok(e) && t2vQualityOk(e, qctx))
      .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
      .filter((e) => !seen.has(e.providerId) && seen.add(e.providerId))
      .slice(0, 8)
  }
  let lineScores: Record<string, Record<string, number>> = {}
  if (Object.values(shortlist).some((l) => l.length)) {
    try {
      lineScores = await scoreSpares(open, shortlist, { script: compactScript(input.shots), videoUnderstanding: input.story.videoUnderstanding })
    } catch (err) {
      logT2v('pipeline-finisher', 'cross-line re-check failed', { error: err instanceof Error ? err.message : 'error' })
    }
  }
  for (const shot of open) {
    if (options.get(shot.sceneId)?.length) continue
    const ok = okFor(shot)
    const ls = lineScores[shot.sceneId] ?? {}
    // Score = the re-check for THIS line, so QA judges it where it sits.
    const cross = (shortlist[shot.sceneId] ?? [])
      .filter((e) => ok(e) && (ls[e.providerId] ?? -1) >= FILLER_MIN_SCORE)
      .sort((a, b) => (ls[b.providerId] ?? -1) - (ls[a.providerId] ?? -1))
      .map((e) => ({ pick: { ...evToPick(e), score: ls[e.providerId]!, matches: ls[e.providerId]! >= 7, reviewedForOtherLine: e.score ?? 0 }, tier: 'last_resort' as const }))
    if (!cross.length) logT2v('pipeline-finisher', 'no option at the floor, extending the previous shot', { sceneId: shot.sceneId, floor: FILLER_MIN_SCORE })
    take(shot, cross)
  }
  // Direction per photo shot, in story order (varied, never two of the same move in a row).
  const photoMove = new Map<string, T2vKenBurns>()
  for (const shot of input.shots) {
    const p = byScene.get(shot.sceneId)?.chosen ?? options.get(shot.sceneId)?.[0]?.pick
    if (p?.kind === 'photo' || p?.providerId.startsWith('img_')) photoMove.set(shot.sceneId, PHOTO_MOVES[photoMove.size % PHOTO_MOVES.length]!)
  }
  const findCand = (sceneId: string, id: string) =>
    (input.candidates[sceneId] ?? []).find((c) => c.providerId === id) ??
    Object.values(input.candidates)
      .flat()
      .find((c) => c.providerId === id)
  const ingest = async (shot: T2vPlannedShot, pick: T2vVerifiedPick): Promise<T2vSceneMedia | null> => {
    const cand = findCand(shot.sceneId, pick.providerId)
    if (!cand) return null
    try {
      const asset = await ensureT2vStockAsset(input.workspaceId, stockCandidateFrom(cand))
      const stock = cand.provider !== 'replicate'
      const base = {
        provider: stock ? (cand.provider as 'pixabay' | 'pexels') : ('ai_video' as const),
        assetId: asset.id,
        providerId: cand.providerId,
        thumbUrl: cand.thumbUrl,
        previewUrl: cand.previewUrl,
        width: cand.width,
        height: cand.height,
        focalX: 0.5,
        focalY: 0.5,
        ...(stock ? { attribution: { author: cand.author, pageUrl: cand.pageUrl, provider: cand.provider as 'pixabay' | 'pexels' } } : {}),
        query: cand.query,
      }
      if (cand.kind === 'photo') return { ...base, kind: 'image', kenBurns: photoMove.get(shot.sceneId) ?? 'zoom_in' }
      return {
        ...base,
        kind: 'video',
        durationMs: Math.round(cand.durationS * 1000),
        // Start early enough that the line fits inside the clip (spare picks were windowed for another line).
        srcInMs: Math.round(Math.max(0, Math.min(pick.inS, cand.durationS - shot.needS - 0.3)) * 1000),
      }
    } catch (err) {
      logT2v('pipeline-finisher', 'stock ingest failed', { sceneId: shot.sceneId, providerId: cand.providerId, error: err instanceof Error ? err.message : 'error' })
      return null
    }
  }
  const placed = await mapLimit(input.shots, 3, async (shot) => {
    const r = byScene.get(shot.sceneId)
    if (r?.chosen) {
      const m = await ingest(shot, r.chosen)
      if (m) return { media: m, pick: r.chosen, tier: r.pickedBy ?? (r.chosen.verdict === 'accepted' ? 'accepted' : 'usable') }
    }
    for (const o of options.get(shot.sceneId) ?? []) {
      if (o !== options.get(shot.sceneId)?.[0] && used.has(o.pick.providerId)) continue
      const m = await ingest(shot, o.pick)
      if (m) {
        used.add(o.pick.providerId)
        return { media: m, pick: o.pick, tier: o.tier }
      }
    }
    return null
  })

  const scenes: T2vScene[] = []
  const results: T2vShotResult[] = []
  input.shots.forEach((shot, i) => {
    const next = input.shots[i + 1]
    const segmentEnd = !next || next.segmentId !== shot.segmentId
    const got = placed[i]
    const r = byScene.get(shot.sceneId) ?? { sceneId: shot.sceneId, chosen: null, evaluated: [] }
    const prevScene = scenes[scenes.length - 1]
    const continues = Boolean(prevScene && input.shots[i - 1] && shot.voiceGroup && input.shots[i - 1]!.voiceGroup === shot.voiceGroup)
    // Continuation (later piece of a split sentence) or nothing at all to show: ride the previous scene.
    if (prevScene && (continues || !got)) {
      const atWord = prevScene.narration.trim().split(/\s+/).length
      prevScene.narration = `${prevScene.narration} ${shot.narration}`
      prevScene.padMs = segmentEnd ? 450 : 120
      prevScene.transition = !next ? 'fade_black' : segmentEnd ? 'dissolve' : 'cut'
      prevScene.transitionMs = segmentEnd ? 450 : 0
      if (got) {
        // In-scene hard cut on the pause before this piece's first word (worker: ElevenLabs word timings).
        ;(prevScene.cuts ??= []).push({ atWord, media: got.media })
        results.push({ ...r, chosen: got.pick, outcome: 'stock', pickedBy: got.tier })
      } else {
        // No reviewed footage anywhere for this line (no unused clip in the whole run).
        results.push({ ...r, outcome: 'held', pickedBy: 'held' })
      }
      return
    }
    results.push(got ? { ...r, chosen: got.pick, outcome: 'stock', pickedBy: got.tier } : { ...r, outcome: 'title_card', pickedBy: 'card' })
    const texts: T2vScene['texts'] = []
    scenes.push({
      id: shot.sceneId,
      slot: scenes.length,
      narration: shot.narration,
      keywords: shot.queries[0]?.toLowerCase().split(/\s+/).slice(0, 6) ?? [],
      visualQuery: shot.queries[0] ?? shot.intent,
      media: got?.media ?? titleCard(),
      minDurMs: 1200,
      padMs: segmentEnd ? 450 : 120,
      // Transition on a scene = how it leaves into the next one (assemble.py xfade order).
      transition: !next ? 'fade_black' : segmentEnd ? 'dissolve' : 'cut',
      transitionMs: segmentEnd ? 450 : 0,
      texts,
    })
  })
  // The last shot fades to black on its own (no end card after it).
  if (scenes.length) scenes[scenes.length - 1]!.transitionMs = 600
  return { scenes, results }
}
