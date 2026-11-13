import 'server-only'
import { searchT2vStock, type StockCandidate } from '@/lib/server/t2v/stock-match'
import { pexelsConfigured } from '@/lib/server/ai/pexels'
import { logT2v } from '@/lib/server/t2v/log'
import type { T2vAspect } from '@/lib/t2v/types'
import type { T2vFootageCandidate, T2vPlannedShot } from '@/lib/t2v/pipeline/t2v-types'

/** Bounded search budget: <= 5 candidates per shot go to the visual reviewer. */
const PER_QUERY = [2, 2, 1]
const MAX_PER_SHOT = 5

function orientationOk(c: StockCandidate, aspect: T2vAspect): boolean {
  const portrait = c.height > c.width
  if (aspect === '9:16') return portrait || c.width / Math.max(1, c.height) < 1.9
  if (aspect === '16:9') return !portrait
  return true
}

function toCandidate(c: StockCandidate, query: string): T2vFootageCandidate {
  return {
    provider: c.provider === 'pexels' ? 'pexels' : 'pixabay',
    providerId: c.providerId,
    previewUrl: c.previewUrl,
    durationS: c.durationS,
    width: c.width,
    height: c.height,
    query,
    tags: c.tags.slice(0, 12),
    srcUrl: c.srcUrl,
    thumbUrl: c.thumbUrl,
    pageUrl: c.pageUrl,
    author: c.author,
  }
}

/** Footage Researcher: multiple specific searches per shot; prefers clips not used by other shots. */
export async function t2vFootageAgent(input: {
  shots: T2vPlannedShot[]
  aspect: T2vAspect
}): Promise<Record<string, T2vFootageCandidate[]>> {
  const sources: Array<'pixabay' | 'pexels'> = pexelsConfigured() ? ['pixabay', 'pexels'] : ['pixabay']
  const out: Record<string, T2vFootageCandidate[]> = {}
  const usedFirst = new Set<string>()
  let searches = 0
  for (const shot of input.shots) {
    const picks: T2vFootageCandidate[] = []
    const seen = new Set<string>()
    for (let qi = 0; qi < shot.queries.length && picks.length < MAX_PER_SHOT; qi++) {
      const query = shot.queries[qi]!
      let ranked: StockCandidate[] = []
      try {
        searches++
        ranked = await searchT2vStock({
          query,
          aspect: input.aspect,
          sources,
          page: 1,
          keywords: query.toLowerCase().split(/\s+/).filter((w) => w.length > 2),
          needMs: Math.round(shot.needS * 1000),
          videoTopic: '',
        })
      } catch (err) {
        logT2v('pipeline-footage', 'search failed', { sceneId: shot.sceneId, error: err instanceof Error ? err.message : 'error' })
        continue
      }
      const usable = ranked.filter(
        (c) =>
          c.stockKind !== 'photo' &&
          c.durationS >= shot.needS + 0.3 &&
          c.durationS <= 75 &&
          orientationOk(c, input.aspect) &&
          !seen.has(`${c.provider}:${c.providerId}`),
      )
      // Prefer clips nobody else leads with; fall back to shared ones if that empties the list.
      const fresh = usable.filter((c) => !usedFirst.has(`${c.provider}:${c.providerId}`))
      const take = (fresh.length ? fresh : usable).slice(0, PER_QUERY[qi] ?? 1)
      for (const c of take) {
        seen.add(`${c.provider}:${c.providerId}`)
        picks.push(toCandidate(c, query))
      }
    }
    if (picks[0]) usedFirst.add(`${picks[0].provider}:${picks[0].providerId}`)
    out[shot.sceneId] = picks.slice(0, MAX_PER_SHOT)
  }
  logT2v('pipeline-footage', 'candidates ready', {
    shots: input.shots.length,
    searches,
    candidates: Object.values(out).reduce((n, l) => n + l.length, 0),
    emptyShots: Object.values(out).filter((l) => !l.length).length,
  })
  return out
}
