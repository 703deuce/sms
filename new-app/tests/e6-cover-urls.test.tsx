// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest'
import { act, render, screen, waitFor } from '@testing-library/react'
import { COVER_URL_REUSE_MS, coverImageClass, stableCoverItems, type CoverUrlCache } from '@/lib/clips/editor/cover-jobs'

const row = (id: string, url: string | null, status = 'READY') => ({ id, status, downloadUrl: url, aspect: '9:16' })

describe('E6 cover thumbnails', () => {
  it('keeps the first signed URL per cover across polls (no re-download each poll)', () => {
    const cache: CoverUrlCache = new Map()
    const a = stableCoverItems([row('t1', 'https://s/x?token=1')], cache, 1000)
    const b = stableCoverItems([row('t1', 'https://s/x?token=2')], cache, 4000)
    expect(a[0].downloadUrl).toBe('https://s/x?token=1')
    expect(b[0].downloadUrl).toBe('https://s/x?token=1')
    const c = stableCoverItems([row('t1', 'https://s/x?token=3')], cache, 1000 + COVER_URL_REUSE_MS + 1)
    expect(c[0].downloadUrl).toBe('https://s/x?token=3')
  })

  it('forgets removed / not-ready covers', () => {
    const cache: CoverUrlCache = new Map()
    stableCoverItems([row('t1', 'u1'), row('t2', 'u2')], cache, 0)
    stableCoverItems([row('t2', null, 'RUNNING')], cache, 1)
    expect(cache.size).toBe(0)
  })

  it('9:16 covers are shown whole, 16:9 fill a video box', () => {
    expect(coverImageClass('9:16')).toContain('aspect-[9/16]')
    expect(coverImageClass('9:16')).toContain('object-contain')
    expect(coverImageClass('16:9')).toContain('aspect-video')
  })

  it('panel img src stays stable while the API re-signs', async () => {
    let n = 0
    vi.doMock('@/lib/clips-api', () => ({
      clipsFetch: vi.fn(async () => ({ items: [{ ...row('t1', `https://s/x?token=${++n}`), titleText: 'T', picked: false, generationId: 'g' }], jobs: [] })),
    }))
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const { ThumbnailPanel } = await import('@/components/clips/editor/thumbnail-panel')
    const edits = { thumbnailId: null } as never
    render(<ThumbnailPanel clipId="c1" edits={edits} onEdits={() => {}} />)
    await waitFor(() => expect(screen.getByTestId('cover-img')).toBeTruthy())
    const first = screen.getByTestId('cover-img').getAttribute('src')
    await act(async () => {
      vi.advanceTimersByTime(16_000)
    })
    await waitFor(() => expect(n).toBeGreaterThan(1))
    expect(screen.getByTestId('cover-img').getAttribute('src')).toBe(first)
    vi.useRealTimers()
  })
})
