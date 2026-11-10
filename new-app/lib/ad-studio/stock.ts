import type { AdAspect, AdScene } from './types'

export type AdStockHit = {
  providerId: string
  durationS: number
  width: number
  height: number
  tags: string
}

export function chooseStockHit(hits: AdStockHit[], seconds: number, aspect: AdAspect): AdStockHit | null {
  console.info('[ad-studio:stock] select_begin', { candidates: hits.length, seconds, aspect })
  const eligible = hits.filter((h) =>
    Boolean(h.providerId) && Number.isFinite(h.durationS) && h.durationS * 1000 >= seconds * 1000 &&
    h.width > 0 && h.height > 0)
  eligible.sort((a, b) => {
    const score = (hit: AdStockHit) => {
      const ratio = hit.width / hit.height
      const target = aspect === '9:16' ? 9/16 : aspect === '16:9' ? 16/9 : 1
      return Math.abs(Math.log(ratio / target))
    }
    return score(a) - score(b)
  })
  const picked = eligible[0] ?? null
  console.info('[ad-studio:stock] select_complete', { selected: Boolean(picked), providerId: picked?.providerId })
  return picked
}

export function stockTrim(scene: Pick<AdScene, 'durationSec' | 'sourceInMs' | 'sourceOutMs'>, hit: AdStockHit): { sourceInMs: number; sourceOutMs: number } {
  console.info('[ad-studio:stock] trim_begin', { providerId: hit.providerId })
  const duration = scene.durationSec * 1000
  const start = Math.max(0, Math.trunc(scene.sourceInMs ?? 0))
  const end = scene.sourceOutMs ?? start + duration
  if (end - start !== duration || end > hit.durationS * 1000)
    throw new Error('Stock source does not cover the planned scene window.')
  console.info('[ad-studio:stock] trim_complete', { providerId: hit.providerId, sourceInMs: start, sourceOutMs: end })
  return { sourceInMs: start, sourceOutMs: end }
}
