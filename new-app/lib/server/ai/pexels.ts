import 'server-only'

/**
 * Pexels Videos API (https://www.pexels.com/api/documentation/#videos-search).
 * No-op when PEXELS_API_KEY is unset.
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
export type PexelsPhoto = {
  id: number
  width: number
  height: number
  url: string
  photographer: string
  photographer_url: string
  src: { original: string; large2x: string; large: string; medium: string; small: string; portrait: string; landscape: string; tiny: string }
}

export async function pexelsSearchPhotos(input: {
  query: string
  orientation?: 'landscape' | 'portrait' | 'square'
  page?: number
  perPage?: number
}): Promise<{ photos: PexelsPhoto[] }> {
  const key = process.env.PEXELS_API_KEY?.trim()
  if (!key) return { photos: [] }
  const u = new URL(`${BASE}/search`)
  u.searchParams.set('query', input.query.slice(0, 100))
  if (input.orientation) u.searchParams.set('orientation', input.orientation)
  u.searchParams.set('page', String(input.page ?? 1))
  u.searchParams.set('per_page', String(Math.min(80, input.perPage ?? 30)))
  const res = await fetch(u, { headers: { Authorization: key }, signal: AbortSignal.timeout(15_000) })
  if (res.status === 429) throw new Error('pexels_rate_limited')
  if (!res.ok) throw new Error(`pexels_http_${res.status}`)
  const body = (await res.json()) as { photos?: PexelsPhoto[] }
  return { photos: body.photos ?? [] }
}

export function pickPexelsFile(v: PexelsVideo, outW: number, outH: number): PexelsVideoFile | null {
  const mp4 = v.video_files.filter((f) => f.file_type === 'video/mp4' && f.width && f.height)
  const covering = mp4
    .filter((f) => Math.max(f.width!, f.height!) >= Math.max(outW, outH))
    .sort((a, b) => a.width! * a.height! - b.width! * b.height!)
  return covering[0] ?? mp4.sort((a, b) => b.width! * b.height! - a.width! * a.height!)[0] ?? null
}
