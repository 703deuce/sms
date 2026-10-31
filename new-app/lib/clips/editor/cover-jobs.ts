/**
 * E1fix: Cover (THUMBNAIL) job tracking for the editor Cover panel. Pure, no React.
 * A cover job takes ~60–90 s (render -> Gemini plan -> 3 Kie images); the panel must show that it
 * is running and must surface a failure instead of going silently empty.
 */
export type CoverJobRow = {
  id: string
  status: string
  error?: string | null
  createdAt?: string
  finishedAt?: string | null
}

export type CoverItemRow = {
  id: string
  status: string
  downloadUrl: string | null
  error?: string | null
}

export function coverJobActive(status: string | undefined | null): boolean {
  return status === 'QUEUED' || status === 'RUNNING'
}

export type CoverNotice =
  | { kind: 'error'; message: string }
  | { kind: 'success'; message: string }
  | { kind: 'info'; message: string }

/**
 * What to tell the user when the tracked job moves on. Returns null while it is still running
 * (or when it is not in the list yet).
 */
export function coverJobNotice(
  trackedJobId: string | null,
  jobs: CoverJobRow[],
  items: CoverItemRow[],
): CoverNotice | null {
  if (!trackedJobId) return null
  const job = jobs.find((j) => j.id === trackedJobId)
  if (!job || coverJobActive(job.status)) return null
  if (job.status === 'DONE') {
    const failed = items.filter((i) => i.status === 'FAILED')
    const pending = items.filter((i) => !i.downloadUrl && i.status !== 'FAILED')
    if (items.length === 0) return { kind: 'error', message: 'Cover job finished but returned no images' }
    if (failed.length && !pending.length && failed.length === items.length) {
      return { kind: 'error', message: failed[0]?.error || 'Cover image generation failed' }
    }
    if (pending.length) return { kind: 'info', message: 'Covers planned — images are rendering' }
    return { kind: 'success', message: 'Covers ready — pick one' }
  }
  const msg = (job.error || '').trim()
  return {
    kind: 'error',
    message: msg ? `Cover generation failed: ${msg.slice(0, 160)}` : `Cover generation ${job.status.toLowerCase()}`,
  }
}

/** Poll faster while a job runs or images are still rendering. */
export function coverPollMs(jobs: CoverJobRow[], items: CoverItemRow[]): number {
  const running = jobs.some((j) => coverJobActive(j.status))
  const rendering = items.some((i) => !i.downloadUrl && (i.status === 'RUNNING' || i.status === 'PENDING'))
  return running || rendering ? 3000 : 15000
}

/**
 * E6: the GET route re-signs every image URL on each poll (3 s while running, 15 s idle), so the
 * <img> src changed every poll and each 5–9 MB PNG cover re-downloaded forever (covers that never
 * finished loading / flickered = "broken"). Keep the first signed URL per thumbnail until it nears
 * its 1 h expiry, or until the <img> reports an error.
 */
export const COVER_URL_REUSE_MS = 45 * 60 * 1000
export type CoverUrlCache = Map<string, { url: string; at: number }>

export function stableCoverItems<T extends CoverItemRow>(items: T[], cache: CoverUrlCache, now = Date.now()): T[] {
  const seen = new Set<string>()
  const out = items.map((it) => {
    seen.add(it.id)
    if (!it.downloadUrl) {
      cache.delete(it.id)
      return it
    }
    const hit = cache.get(it.id)
    if (hit && now - hit.at < COVER_URL_REUSE_MS) return hit.url === it.downloadUrl ? it : { ...it, downloadUrl: hit.url }
    cache.set(it.id, { url: it.downloadUrl, at: now })
    return it
  })
  for (const id of [...cache.keys()]) if (!seen.has(id)) cache.delete(id)
  return out
}

/** Tailwind classes so a 9:16 cover is shown whole instead of a centre strip of a 16:9 box. */
export function coverImageClass(aspect: string | null | undefined): string {
  return aspect === '9:16'
    ? 'mx-auto mb-2 aspect-[9/16] max-h-72 w-auto rounded bg-muted object-contain'
    : 'mb-2 aspect-video w-full rounded bg-muted object-cover'
}
