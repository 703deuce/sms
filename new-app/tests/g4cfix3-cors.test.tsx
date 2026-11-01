// @vitest-environment happy-dom
/** G4cfix3: a CORS load failure first refreshes the poisoned cache entry, then retries WITH crossorigin. */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { onMediaCorsError } from '@/components/clips/editor/g4/media-cors'
import {
  CLIPS_BROWSER_DOWNLOAD_TTL_SEC,
  CLIPS_EDITOR_MEDIA_TTL_HISTORY_SEC,
  CLIPS_EDITOR_MEDIA_TTL_SEC,
} from '@/lib/storage/signed-download-cache'

const B2 = 'https://s3.us-east-005.backblazeb2.com/transovo'
const tick = () => new Promise((r) => setTimeout(r, 0))
afterEach(() => vi.unstubAllGlobals())

function el<T extends 'video' | 'img'>(tag: T, url: string) {
  const e = document.createElement(tag)
  e.crossOrigin = 'anonymous'
  e.setAttribute('src', url)
  return e
}

describe('G4cfix3 CORS cache refresh', () => {
  it('video: refetch (cors, cache reload, Range 0-1) → retry keeps crossorigin; a 2nd failure falls back plain', async () => {
    const url = `${B2}/c/source.mp4?X-Amz-Signature=v1`
    const f = vi.fn(async () => new Response('ab', { status: 206 }))
    vi.stubGlobal('fetch', f)
    const v = el('video', url)
    const load = vi.spyOn(v, 'load').mockImplementation(() => {})
    expect(onMediaCorsError(v)).toBe(true)
    await tick()
    expect(f).toHaveBeenCalledWith(url, expect.objectContaining({ mode: 'cors', cache: 'reload', headers: { Range: 'bytes=0-1' } }))
    expect(v.getAttribute('crossorigin')).toBe('anonymous')
    expect(load).toHaveBeenCalledTimes(1)
    // the retry failed too → plain once, then no more handling
    expect(onMediaCorsError(v)).toBe(true)
    expect(v.getAttribute('crossorigin')).toBeNull()
    expect(onMediaCorsError(v)).toBe(false)
  })

  it('poster: one shared full refetch per URL; refetch without ACAO (rejects) → plain', async () => {
    const ok = `${B2}/c/poster.jpg?X-Amz-Signature=p1`
    const f = vi.fn(async () => new Response('x', { status: 200 }))
    vi.stubGlobal('fetch', f)
    const a = el('img', ok)
    const b = el('img', ok)
    onMediaCorsError(a)
    onMediaCorsError(b)
    await tick()
    expect(f).toHaveBeenCalledTimes(1)
    expect((f.mock.calls[0] as unknown[])[1]).not.toHaveProperty('headers')
    expect([a, b].map((x) => x.getAttribute('crossorigin'))).toEqual(['anonymous', 'anonymous'])

    const bad = `${B2}/c/poster.jpg?X-Amz-Signature=p2`
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new TypeError('No ACAO'))))
    const c = el('img', bad)
    onMediaCorsError(c)
    await tick()
    expect(c.getAttribute('crossorigin')).toBeNull()
  })

  it('editor URLs re-keyed: TTL differs from the grid and from every earlier editor TTL', () => {
    expect(CLIPS_EDITOR_MEDIA_TTL_SEC).not.toBe(CLIPS_BROWSER_DOWNLOAD_TTL_SEC)
    expect(CLIPS_EDITOR_MEDIA_TTL_HISTORY_SEC).not.toContain(CLIPS_EDITOR_MEDIA_TTL_SEC)
    expect(CLIPS_EDITOR_MEDIA_TTL_SEC).toBeGreaterThan(24 * 3600)
  })
})
