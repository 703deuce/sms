import 'server-only'

/**
 * Pexels Videos API (https://www.pexels.com/api/documentation/#videos-search).
 * GET https://api.pexels.com/v1/videos/search  Header: Authorization: <PEXELS_API_KEY>
 * Params: query, orientation (landscape|portrait|square), size (large=4K|medium=FHD|small=HD),
 *         locale, page, per_page (<= 80). Limits: 200 req/hour, 20,000 req/month by default;
 *         read X-Ratelimit-Limit / X-Ratelimit-Remaining / X-Ratelimit-Reset.
 * Attribution: show "Videos provided by Pexels" + link back; credit the author where possible.
 * BLOCKED: PEXELS_API_KEY is not set on prod (web or workers). Code must no-op cleanly without it.
 */
const BASE = 'https://api.pexels.com/v1'

export type PexelsVideoFile = {
  id: number
  quality: 'hd' | 'sd' | 'hls' | string
  file_type: string
  width: number | null
  height: number | null
  fps?: number
  link: string
}
export type PexelsVideo = {
  id: number
  width: number
  height: number
  url: string
  image: string
  duration: number
  user: { id: number; name: string; url: string }
  video_files: PexelsVideoFile[]
  video_pictures: { id: number; picture: string; nr: number }[]
}

export function pexelsConfigured(): boolean {
  return Boolean(process.env.PEXELS_API_KEY?.trim())
}

export async function pexelsSearchVideos(input: {
  query: string
  orientation?: 'landscape' | 'portrait' | 'square'
  size?: 'large' | 'medium' | 'small'
  locale?: string
  page?: number
  perPage?: number
}): Promise<{ videos: PexelsVideo[]; remaining: number | null }> {
  const key = process.env.PEXELS_API_KEY?.trim()
  if (!key) return { videos: [], remaining: null }
  const u = new URL(`${BASE}/videos/search`)
  u.searchParams.set('query', input.query.slice(0, 100))
  if (input.orientation) u.searchParams.set('orientation', input.orientation)
  u.searchParams.set('size', input.size ?? 'medium')
  if (input.locale) u.searchParams.set('locale', input.locale)
  u.searchParams.set('page', String(input.page ?? 1))
  u.searchParams.set('per_page', String(Math.min(80, input.perPage ?? 30)))
  const res = await fetch(u, { headers: { Authorization: key }, signal: AbortSignal.timeout(15_000) })
  const remaining = Number(res.headers.get('X-Ratelimit-Remaining') ?? NaN)
  if (res.status === 429) throw new Error('pexels_rate_limited')
  if (!res.ok) throw new Error(`pexels_http_${res.status}`)
  const body = (await res.json()) as { videos?: PexelsVideo[] }
  return { videos: body.videos ?? [], remaining: Number.isFinite(remaining) ? remaining : null }
}

/** Pick the smallest mp4 rendition that still covers the output (avoid 4K downloads). */
export function pickPexelsFile(v: PexelsVideo, outW: number, outH: number): PexelsVideoFile | null {
  const mp4 = v.video_files.filter((f) => f.file_type === 'video/mp4' && f.width && f.height)
  const covering = mp4
    .filter((f) => Math.max(f.width!, f.height!) >= Math.max(outW, outH))
    .sort((a, b) => a.width! * a.height! - b.width! * b.height!)
  return covering[0] ?? mp4.sort((a, b) => b.width! * b.height! - a.width! * a.height!)[0] ?? null
}
