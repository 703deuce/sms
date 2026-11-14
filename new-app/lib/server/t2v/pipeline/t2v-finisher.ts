import 'server-only'
import { nearDuplicateHash, t2vMonoRequested, t2vNightLine, t2vQualityOk } from '@/lib/server/t2v/pipeline/t2v-no-repeat'
import { t2vRealisticStyle } from '@/lib/t2v/pipeline/t2v-types'
import { ensureT2vStockAsset } from '@/lib/server/t2v/stock-asset'
import type { StockCandidate } from '@/lib/server/t2v/stock-match'
import { logT2v } from '@/lib/server/t2v/log'
import type { T2vDraftV1, T2vScene, T2vSceneMedia } from '@/lib/t2v/types'
import type {
  T2vFootageCandidate,
  T2vVerifiedPick,
  T2vNarrationSegment,
  T2vPipelineRun,
  T2vPlannedShot,
  T2vShotResult,
  T2vStoryPlan,
} from '@/lib/t2v/pipeline/t2v-types'
import { T2V_END_CARD_S } from '@/lib/server/t2v/pipeline/t2v-story-agent'

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
  }
}

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

/** Longest a single shot may stay on screen when later lines are held on it. */
const MAX_HELD_SHOT_MS = 8000

function titleCard(): T2vSceneMedia {
  return { provider: 'color', kind: 'color', color: TITLE_CARD_COLOR }
}

/**
 * Finisher: turns verified shots into a real T2V draft edit (the same document the storyboard
 * editor, T2V_ASSEMBLE worker and composition export already understand).
 * - verified stock clip trimmed to the reviewer's in-point; audio is never used (-an in assemble)
 * - honest title card when no footage passed review
 * - hard cuts inside a segment, dissolves between segments, opening title, closing end card
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
}): Promise<{ scenes: T2vScene[]; results: T2vShotResult[] }> {
  const byScene = new Map(input.results.map((r) => [r.sceneId, r]))
  // Last-resort pick per scene when nothing was chosen: the highest-scoring reviewed clip (any score),
  // never one already used by another scene. Used only if holding the previous clip isn't possible.
  const used = new Set(input.results.map((r) => r.chosen?.providerId).filter(Boolean) as string[])
  const usedHashes = input.results.map((r) => r.chosen?.phash).filter((h): h is string[] => Boolean(h?.length))
  const fallback = new Map<string, T2vVerifiedPick>()
  const qctx = (shot: T2vPlannedShot) => ({
    realistic: t2vRealisticStyle(input.run.style),
    nightOk: t2vNightLine(shot.narration, shot.intent),
    monoOk: t2vMonoRequested(input.run.prompt),
  })
  for (const shot of input.shots) {
    const r = byScene.get(shot.sceneId)
    if (r?.chosen) continue
    const best = [...(r?.evaluated ?? [])]
      .filter((e) => !e.error && typeof e.score === 'number' && !used.has(e.providerId))
      // Never a look-alike of a shot already in the edit (hard no-repeat rule).
      .filter((e) => !usedHashes.some((h) => nearDuplicateHash(e.phash, h)))
      // Clips passing the quality rules (live action, lit, daylight for day lines, colour) first.
      .sort((a, b) => Number(t2vQualityOk(b, qctx(shot))) - Number(t2vQualityOk(a, qctx(shot))) || (b.score ?? 0) - (a.score ?? 0))[0]
    if (!best) continue
    used.add(best.providerId)
    if (best.phash?.length) usedHashes.push(best.phash)
    fallback.set(shot.sceneId, {
      provider: best.provider ?? 'pixabay',
      providerId: best.providerId,
      query: best.query,
      visible: best.visible ?? '',
      matches: Boolean(best.matches),
      score: best.score ?? 0,
      inS: best.inS ?? 0,
      outS: best.outS ?? 0,
      clipS: best.clipS ?? 0,
      issues: best.issues,
      style: best.style,
      framing: best.framing,
      phash: best.phash,
      verdict: 'best_available',
    })
  }
  const media = await mapLimit(input.shots, 3, async (shot) => {
    const r = byScene.get(shot.sceneId)
    const pick = r?.chosen ?? fallback.get(shot.sceneId)
    if (!pick) return null
    // A spare pick may come from another scene's candidate list (on-topic B-roll reviewed for another line).
    const cand =
      (input.candidates[shot.sceneId] ?? []).find((c) => c.providerId === pick.providerId) ??
      Object.values(input.candidates)
        .flat()
        .find((c) => c.providerId === pick.providerId)
    if (!cand) return null
    try {
      const asset = await ensureT2vStockAsset(input.workspaceId, stockCandidateFrom(cand))
      const m: T2vSceneMedia = {
        provider: cand.provider,
        kind: 'video',
        assetId: asset.id,
        providerId: cand.providerId,
        thumbUrl: cand.thumbUrl,
        previewUrl: cand.previewUrl,
        width: cand.width,
        height: cand.height,
        durationMs: Math.round(cand.durationS * 1000),
        // Start early enough that the line fits inside the clip (spare picks were windowed for another line).
        srcInMs: Math.round(Math.max(0, Math.min(pick.inS, cand.durationS - shot.needS - 0.3)) * 1000),
        focalX: 0.5,
        focalY: 0.5,
        attribution: { author: cand.author, pageUrl: cand.pageUrl, provider: cand.provider },
        query: cand.query,
      }
      return m
    } catch (err) {
      logT2v('pipeline-finisher', 'stock ingest failed', {
        sceneId: shot.sceneId,
        providerId: cand.providerId,
        error: err instanceof Error ? err.message : 'error',
      })
      return null
    }
  })

  const scenes: T2vScene[] = []
  const results: T2vShotResult[] = []
  // Spoken ms already riding on the last emitted scene's clip (for holding it under a later line).
  let lastNeedMs = 0
  input.shots.forEach((shot, i) => {
    const next = input.shots[i + 1]
    const segmentEnd = !next || next.segmentId !== shot.segmentId
    // A best-available pick is a fallback: continuing the previous shot (one continuous take) wins over it.
    const isFallback = byScene.get(shot.sceneId)?.chosen?.verdict === 'best_available' || (!byScene.get(shot.sceneId)?.chosen && fallback.has(shot.sceneId))
    const fm = media[i]
    const m = isFallback ? null : fm
    const r = byScene.get(shot.sceneId) ?? { sceneId: shot.sceneId, chosen: null, evaluated: [] }
    const needMs = Math.round(shot.needS * 1000)
    // No clip passed review: keep the previous verified clip running under this line when it is in
    // the same segment and has enough unused footage — a held shot reads better than a dark card.
    const prev = scenes[scenes.length - 1]
    const prevShot = input.shots[i - 1]
    if (!m && prev && prevShot && prevShot.segmentId === shot.segmentId && prev.media.kind === 'video') {
      const left = (prev.media.durationMs ?? 0) - (prev.media.srcInMs ?? 0)
      // A held shot never runs past ~8 s on screen: longer lines get a new distinct clip instead.
      if (left >= lastNeedMs + needMs + 600 && lastNeedMs + needMs <= MAX_HELD_SHOT_MS) {
        prev.narration = `${prev.narration} ${shot.narration}`
        prev.padMs = segmentEnd ? 450 : 120
        prev.transition = !next ? 'fade_black' : segmentEnd ? 'dissolve' : 'cut'
        prev.transitionMs = segmentEnd ? 450 : 0
        lastNeedMs += needMs
        results.push({ ...r, outcome: 'held', pickedBy: 'held' })
        return
      }
    }
    lastNeedMs = needMs
    if (!m && fm) {
      // Every scene gets footage: the best-scoring reviewed clip beats a text card.
      results.push({ ...r, chosen: r.chosen ?? fallback.get(shot.sceneId)!, outcome: 'stock', pickedBy: r.chosen ? r.pickedBy ?? 'fallback' : 'fallback' })
    } else {
      results.push({ ...r, outcome: m ? 'stock' : 'title_card', pickedBy: m ? r.pickedBy ?? 'accepted' : 'card' })
    }
    const sceneMedia = m ?? fm
    const texts: T2vScene['texts'] = []
    if (i === 0) {
      texts.push({ id: 't_open', kind: 'title', text: input.story.title, startMs: 300, endMs: 3300, animation: 'fade' })
    } else if (!sceneMedia) {
      // Last resort (no footage at all): plain dark card. Only designed on-screen copy may appear —
      // never planner notes, segment labels or search queries. Captions carry the narration.
      if (shot.onScreenText) {
        texts.push({ id: `t_card_${i}`, kind: 'title', text: shot.onScreenText, startMs: 0, endMs: Math.round(shot.needS * 1000), animation: 'fade' })
      }
    } else if (shot.onScreenText) {
      // Burned captions sit at the bottom centre, where a lower third would collide with them (run 2),
      // so with captions on the headline is a short centred title that slides up instead.
      texts.push(
        input.doc.settings.captionsEnabled
          ? { id: `t_hl_${i}`, kind: 'title', text: shot.onScreenText, startMs: 300, endMs: 2600, animation: 'slide_up' }
          : { id: `t_lt_${i}`, kind: 'lower_third', text: shot.onScreenText, startMs: 400, endMs: 3200, animation: 'slide_up' },
      )
    }
    scenes.push({
      id: shot.sceneId,
      slot: i,
      narration: shot.narration,
      onScreenText: shot.onScreenText,
      keywords: shot.queries[0]?.toLowerCase().split(/\s+/).slice(0, 6) ?? [],
      visualQuery: shot.queries[0] ?? shot.intent,
      media: sceneMedia ?? titleCard(),
      minDurMs: 1800,
      padMs: segmentEnd ? 450 : 120,
      // Transition on a scene = how it leaves into the next one (assemble.py xfade order).
      transition: !next ? 'fade_black' : segmentEnd ? 'dissolve' : 'cut',
      transitionMs: segmentEnd ? 450 : 0,
      texts,
    })
  })
  // Closing end card: title on black, no narration.
  const endSlot = scenes.length
  scenes.push({
    id: `sc_end_${Math.random().toString(36).slice(2, 8)}`,
    slot: endSlot,
    narration: '',
    keywords: [],
    visualQuery: '',
    media: { provider: 'color', kind: 'color', color: '#000000' },
    minDurMs: Math.round(T2V_END_CARD_S * 1000),
    padMs: 0,
    transition: 'cut',
    transitionMs: 0,
    texts: [{ id: 't_end', kind: 'title', text: input.story.title, startMs: 200, endMs: Math.round(T2V_END_CARD_S * 1000), animation: 'fade' }],
  })
  if (scenes.length >= 2) scenes[scenes.length - 2]!.transitionMs = 600
  return { scenes, results }
}
