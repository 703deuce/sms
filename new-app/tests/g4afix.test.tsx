// @vitest-environment happy-dom
/**
 * G4afix: CORS-mode editor media + fallback, editor-only signed URL variant, slider thumb never
 * hidden after Reset → Auto, and the preview's 100 ms color-keyframe steps.
 */
import { describe, expect, it, vi } from 'vitest'
import { act, render } from '@testing-library/react'
import { SliderRow } from '@/components/clips/editor/e4/slider-row'
import { corsMediaProps, isCrossOriginUrl, onMediaCorsError, prepareMediaCors, setMediaSrc, watchMediaCors } from '@/components/clips/editor/g4/media-cors'
import { corsKnown } from '@/components/clips/editor/g4/grade-gl'
import { CLIPS_BROWSER_DOWNLOAD_TTL_SEC, CLIPS_EDITOR_MEDIA_TTL_SEC, createCachedSignedDownloadUrl } from '@/lib/storage/signed-download-cache'
import { videoGradeAt } from '@/lib/clips/editor/grade-runtime'
import { COLOR_STEP_MS } from '@/lib/clips/editor/color-grade'
import { defaultEdits, normalizeEdits, type ClipEditsV2 } from '@/lib/clips/edits'
import type { ClipStorageDriver } from '@/lib/storage/types'

const B2 = 'https://s3.us-west-004.backblazeb2.com/bucket/clips/a.mp4?X-Amz-Signature=x'

describe('media-cors', () => {
  it('detects cross-origin http(s) media only', () => {
    expect(isCrossOriginUrl(B2)).toBe(true)
    expect(isCrossOriginUrl('/api/clips/luts/x')).toBe(false)
    expect(isCrossOriginUrl(`${location.origin}/a.mp4`)).toBe(false)
    expect(isCrossOriginUrl('blob:http://x/1')).toBe(false)
    expect(isCrossOriginUrl('data:image/png;base64,AA')).toBe(false)
  })

  it('sets crossOrigin before the first fetch and falls back to a plain load on a CORS error', () => {
    const v = document.createElement('video')
    v.setAttribute('src', B2)
    prepareMediaCors(v)
    expect(v.crossOrigin).toBe('anonymous')
    const load = vi.spyOn(v, 'load').mockImplementation(() => {})
    expect(onMediaCorsError(v)).toBe(true)
    expect(v.hasAttribute('crossorigin')).toBe(false)
    expect(load).toHaveBeenCalledTimes(1)
    expect(corsKnown(B2)).toBe('no')
    // Known no-CORS URL: never re-armed (no load loop), panels get plain props.
    prepareMediaCors(v)
    expect(v.hasAttribute('crossorigin')).toBe(false)
    expect(onMediaCorsError(v)).toBe(false)
    expect(corsMediaProps(B2)).toEqual({})
  })

  it('watch: new and re-pointed media get CORS mode; errors bubble to the fallback', async () => {
    const root = document.createElement('div')
    document.body.appendChild(root)
    const stop = watchMediaCors(root)
    const img = document.createElement('img')
    img.setAttribute('src', 'https://f.example.com/b.jpg')
    root.appendChild(img)
    await new Promise((r) => setTimeout(r, 0))
    expect(img.crossOrigin).toBe('anonymous')
    img.dispatchEvent(new Event('error'))
    expect(img.hasAttribute('crossorigin')).toBe(false)
    const v = document.createElement('video')
    vi.spyOn(v, 'load').mockImplementation(() => {})
    root.appendChild(v)
    setMediaSrc(v, 'https://f.example.com/c.mp4')
    expect(v.crossOrigin).toBe('anonymous')
    setMediaSrc(v, '/same-origin.mp4')
    expect(v.hasAttribute('crossorigin')).toBe(false)
    stop()
    root.remove()
  })

  it('panel props: crossOrigin + fallback for cross-origin, nothing for same-origin', () => {
    const p = corsMediaProps('https://f.example.com/d.mp4')
    expect(p.crossOrigin).toBe('anonymous')
    expect(typeof p.onError).toBe('function')
    expect(corsMediaProps('/x.mp4')).toEqual({})
    expect(corsMediaProps(null)).toEqual({})
  })
})

describe('editor signed-URL variant', () => {
  it('editor TTL differs and is cached separately from the shared 7-day URL', async () => {
    expect(CLIPS_EDITOR_MEDIA_TTL_SEC).not.toBe(CLIPS_BROWSER_DOWNLOAD_TTL_SEC)
    expect(CLIPS_EDITOR_MEDIA_TTL_SEC).toBeGreaterThan(24 * 3600)
    const sign = vi.fn(async (k: string, ttl: number) => `https://b2/${k}?ttl=${ttl}`)
    const storage = { createSignedDownloadUrl: sign, getObjectVersionToken: async () => 'v1' } as unknown as ClipStorageDriver
    const shared = await createCachedSignedDownloadUrl(storage, 'k/p.mp4')
    const editor = await createCachedSignedDownloadUrl(storage, 'k/p.mp4', undefined, CLIPS_EDITOR_MEDIA_TTL_SEC)
    expect(shared).not.toBe(editor)
    expect(await createCachedSignedDownloadUrl(storage, 'k/p.mp4', undefined, CLIPS_EDITOR_MEDIA_TTL_SEC)).toBe(editor)
    expect(sign).toHaveBeenCalledTimes(2)
  })
})

describe('slider row', () => {
  const thumbs = (el: HTMLElement) => [...el.querySelectorAll<HTMLElement>('[data-slot=slider-thumb]')]
  it('thumb stays visible across Reset → Auto value changes and non-finite values', () => {
    const r = render(<SliderRow label="Saturation" value={40} min={-100} max={100} onCommit={() => {}} testId="sat" />)
    const check = () => {
      const row = r.getByTestId('sat-row')
      expect(thumbs(row).length).toBe(1)
      for (const t of thumbs(row)) expect(t.getAttribute('style') ?? '').not.toMatch(/visibility:\s*hidden/)
    }
    check()
    act(() => r.rerender(<SliderRow label="Saturation" value={0} min={-100} max={100} onCommit={() => {}} testId="sat" />))
    check()
    act(() => r.rerender(<SliderRow label="Saturation" value={Number.NaN} min={-100} max={100} onCommit={() => {}} testId="sat" />))
    check()
    expect(r.getByTestId('sat-value').textContent).toBe('0')
    act(() => r.rerender(<SliderRow label="Saturation" value={12} min={-100} max={100} onCommit={() => {}} testId="sat" />))
    check()
    expect(r.getByTestId('sat-value').textContent).toBe('12')
  })
})

describe('preview color keyframes', () => {
  const bounds = { clipStartMs: 0, clipEndMs: 20000, trimMinMs: 0, trimMaxMs: 40000 }
  it('are stepped at 100 ms (same windows as the export)', () => {
    const e = {
      ...normalizeEdits(defaultEdits(bounds), bounds),
      keyframes: [{ target: 'video', prop: 'cSaturation', points: [{ tMs: 0, v: 0 }, { tMs: 1000, v: 100 }] }],
    } as ClipEditsV2
    const sat = (outMs: number) => videoGradeAt(e, outMs, outMs)?.adjust?.saturation ?? 0
    expect(COLOR_STEP_MS).toBe(100)
    expect(sat(0)).toBe(0)
    expect(sat(99)).toBe(0)
    expect(sat(100)).toBe(10)
    expect(sat(150)).toBe(10)
    expect(sat(199.9)).toBe(10)
    expect(sat(200)).toBe(20)
    expect(sat(555)).toBe(50)
    expect(sat(1000)).toBe(100)
  })
})
