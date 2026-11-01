// @vitest-environment happy-dom
/**
 * G4cfix2: every element that loads a B2 signed URL on the editor route is in CORS mode
 * (crossorigin="anonymous" set before src) — in the client render AND in the SSR HTML, which the
 * browser starts fetching before hydration (the live failure: SSR markup had no crossorigin).
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { renderToString } from 'react-dom/server'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
// The upload client (tus) is not needed to render thumbnails.
vi.mock('@/lib/clips/upload', () => ({}))
import { PreviewStage } from '@/components/clips/editor/preview-stage'
import { MediaThumb } from '@/components/clips/editor/media-panel'
import { TemplateStage } from '@/components/clips/editor/template-stage'
import { TimelineFilmstrip } from '@/components/clips/editor/timeline/timeline-filmstrip'
import { BrollPreviewVideo } from '@/components/clips/editor/broll-preview-video'
import { corsMediaProps, isCrossOriginUrl, onMediaCorsError } from '@/components/clips/editor/g4/media-cors'
import { normalizeEdits } from '@/lib/clips/edits'
import type { ProjectMediaItem } from '@/lib/clips/editor/media-add'

const B2 = 'https://transovo-clips.s3.us-east-005.backblazeb2.com'
const SRC = `${B2}/clips/p/c/source.mp4?X-Amz-Signature=a`
const POSTER = `${B2}/clips/p/c/poster.jpg?X-Amz-Signature=b`
const UPL = `${B2}/uploads/upl_1/source.mp4?X-Amz-Signature=c`
const IMG = `${B2}/uploads/upl_2/photo.jpg?X-Amz-Signature=d`
const bounds = { clipStartMs: 0, clipEndMs: 6000 }
const edits = normalizeEdits({ v: 2, trim: { in: 0, out: 6000 }, layout: { mode: 'center_crop', shotOverrides: [] }, aspectRatio: '9:16' }, bounds)
const item = (id: string, url: string, mediaType: 'video' | 'image') => ({ id, refId: id, url, mediaType, name: id }) as unknown as ProjectMediaItem
const spec = { templateId: 't', playW: 1080, playH: 1920, bands: [], panels: [{ dest: { x: 0, y: 0, w: 1080, h: 1920 }, src: { x: 0, y: 0, w: 1, h: 1 }, fit: 'cover' }] } as never

function tree() {
  return (
    <div>
      <PreviewStage videoUrl={SRC} posterUrl={POSTER} edits={edits} words={[]} cropTrack={null} brollMedia={[]} videoRef={{ current: null }} onTick={vi.fn()} testBoxSize={{ w: 360, h: 640 }} />
      <MediaThumb item={item('u1', UPL, 'video')} />
      <MediaThumb item={item('u2', IMG, 'image')} />
      <TimelineFilmstrip fromMs={0} toMs={4000} widthPx={200} heightPx={40} pxPerMs={0.05} stillUrl={POSTER} />
      <BrollPreviewVideo src={UPL} videoRef={() => {}} />
    </div>
  )
}

function b2Media(root: ParentNode): Element[] {
  return Array.from(root.querySelectorAll('video, img, audio')).filter((el) => (el.getAttribute('src') ?? '').startsWith(B2))
}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('G4cfix2 CORS on every B2 medium', () => {
  it('client render: every B2 <video>/<img> has crossorigin="anonymous"', () => {
    const { container } = render(tree())
    const els = b2Media(container)
    expect(els.length).toBeGreaterThanOrEqual(5)
    for (const el of els) expect([el.outerHTML.slice(0, 120), el.getAttribute('crossorigin')]).toEqual([el.outerHTML.slice(0, 120), 'anonymous'])
  })

  it('SSR HTML (no location) already carries crossorigin before the browser fetches', () => {
    vi.stubGlobal('location', undefined)
    expect(isCrossOriginUrl(SRC)).toBe(true)
    expect(isCrossOriginUrl('/local.png')).toBe(false)
    const html = renderToString(
      <div>
        <MediaThumb item={item('u1', UPL, 'video')} />
        <MediaThumb item={item('u2', IMG, 'image')} />
        <TemplateStage spec={spec} videoUrl={SRC} posterUrl={POSTER} staticPoster />
        <img {...corsMediaProps(POSTER)} src={POSTER} alt="" />
      </div>,
    )
    vi.unstubAllGlobals()
    const doc = new DOMParser().parseFromString(html, 'text/html')
    const els = b2Media(doc)
    expect(els.length).toBeGreaterThanOrEqual(3)
    for (const el of els) expect(el.getAttribute('crossorigin')).toBe('anonymous')
  })

  it('a CORS element rendered by JSX / SSR falls back once on error (no data-g4cors needed)', async () => {
    // G4cfix3: the cache-refresh refetch fails (host really sends no ACAO) → plain fallback.
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new TypeError('Failed to fetch'))))
    const img = document.createElement('img')
    img.crossOrigin = 'anonymous'
    img.setAttribute('src', POSTER + '&g4cfix2')
    expect(onMediaCorsError(img)).toBe(true)
    await new Promise((r) => setTimeout(r, 0))
    vi.unstubAllGlobals()
    expect(img.getAttribute('crossorigin')).toBeNull()
    expect(onMediaCorsError(img)).toBe(false)
  })

  it('source guard: every editor <img>/<video>/<audio> with a dynamic src spreads corsMediaProps BEFORE src', () => {
    const root = join(process.cwd(), 'components/clips/editor')
    // Static / non-B2 sources only (brand logos, generated mask thumbs, Pixabay stock CDN).
    const allow = new Set(['platform-badge.tsx', 'timeline/transition-popover.tsx', 'stock-broll-picker.tsx'])
    const files: string[] = []
    const walk = (d: string) => {
      for (const f of readdirSync(d)) {
        const p = join(d, f)
        if (statSync(p).isDirectory()) walk(p)
        else if (p.endsWith('.tsx')) files.push(p)
      }
    }
    walk(root)
    const bad: string[] = []
    for (const p of files) {
      const rel = relative(root, p)
      if (allow.has(rel)) continue
      const s = readFileSync(p, 'utf8')
      for (const m of s.matchAll(/<(img|video|audio)\b([^>]*?)\/?>/gs)) {
        const attrs = m[2]!
        const src = attrs.search(/\bsrc=\{/)
        if (src < 0) continue
        const cors = attrs.search(/corsMediaProps\(/)
        if (cors < 0 || cors > src) bad.push(`${rel}: <${m[1]}${attrs.slice(0, 80).replace(/\s+/g, ' ')}`)
      }
    }
    expect(bad).toEqual([])
  })
})
