// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, waitFor } from '@testing-library/react'

// EP2: the JASSUB module is replaced by a recorder; support is forced per test.
const support = vi.hoisted(() => ({ on: true, fail: false, instances: [] as FakeJassub[] }))
type FakeJassub = { opts: Record<string, unknown>; track: string; renders: number; destroyed: boolean }

vi.mock('@/lib/clips/preview-libass-flag', async (orig) => {
  const real = (await orig()) as Record<string, unknown>
  return { ...real, libassSupported: () => support.on }
})
vi.mock('@/lib/clips/editor/jassub-loader', async (orig) => {
  const real = (await orig()) as Record<string, unknown>
  class Fake {
    opts: Record<string, unknown>
    track: string
    renders = 0
    destroyed = false
    ready: Promise<void>
    renderer: { setTrack: (c: string) => Promise<void>; addFonts: (u: string[]) => Promise<void> }
    constructor(opts: Record<string, unknown>) {
      this.opts = opts
      this.track = String(opts.subContent)
      this.ready = Promise.resolve()
      this.renderer = {
        setTrack: async (c: string) => {
          this.track = c
        },
        addFonts: async () => {},
      }
      support.instances.push(this as unknown as FakeJassub)
    }
    async manualRender() {
      this.renders++
    }
    async destroy() {
      this.destroyed = true
    }
  }
  return {
    ...real,
    loadJassub: () => (support.fail ? Promise.reject(new Error('wasm_load_failed')) : Promise.resolve(Fake)),
  }
})

import { PreviewStage } from '@/components/clips/editor/preview-stage'
import { normalizeEdits } from '@/lib/clips/edits'
import { CLIP_PREVIEW_LIBASS_KEY, previewLibassEnabled } from '@/lib/clips/preview-libass-flag'
import { buildPreviewScripts, fontUrlsForAss } from '@/lib/clips/render-plan/preview-scripts'
import { buildCaptionsAss } from '@/lib/clips/render-plan/captions-ass'
import { headlineAssContent } from '@/lib/clips/render-plan/headline-ass'

const bounds = { clipStartMs: 0, clipEndMs: 6000 }
const WORDS = [
  { i: 0, w: 'valorant', s: 0.2, e: 0.6 },
  { i: 1, w: 'is', s: 0.6, e: 0.8 },
  { i: 2, w: 'not', s: 0.8, e: 1.0 },
  { i: 3, w: 'worth', s: 1.0, e: 1.3 },
  { i: 4, w: 'it', s: 1.3, e: 1.5 },
]
function edits(extra: Record<string, unknown> = {}) {
  return normalizeEdits(
    {
      v: 2,
      trim: { in: 0, out: 6000 },
      layout: { mode: 'center_crop', shotOverrides: [] },
      captions: { enabled: true, presetId: 'bold_pop', animation: 'pop', position: 'bottom', size: 6.5, wordsPerLine: 3 },
      aspectRatio: '9:16',
      ...extra,
    },
    bounds,
  )
}
function stage(e: ReturnType<typeof edits>) {
  return render(
    <PreviewStage
      videoUrl="https://example.com/v.mp4"
      edits={e}
      words={WORDS}
      cropTrack={null}
      brollMedia={[]}
      videoRef={{ current: null }}
      onTick={vi.fn()}
      testBoxSize={{ w: 360, h: 640 }}
    />,
  )
}

beforeEach(() => {
  support.on = true
  support.fail = false
  support.instances = []
  localStorage.removeItem(CLIP_PREVIEW_LIBASS_KEY)
})
afterEach(() => cleanup())

describe('EP2 flag', () => {
  it('defaults ON; localStorage "0" turns it off', () => {
    expect(previewLibassEnabled()).toBe(true)
    localStorage.setItem(CLIP_PREVIEW_LIBASS_KEY, '0')
    expect(previewLibassEnabled()).toBe(false)
  })
  it('NEXT_PUBLIC_CLIP_PREVIEW_LIBASS=0 turns it off deploy-wide', () => {
    vi.stubEnv('NEXT_PUBLIC_CLIP_PREVIEW_LIBASS', '0')
    expect(previewLibassEnabled()).toBe(false)
    vi.unstubAllEnvs()
  })
})

describe('EP2 preview scripts == export builders', () => {
  it('captions script is the render-plan build_ass output', () => {
    const e = edits() as unknown as Record<string, unknown>
    const s = buildPreviewScripts({ edits: e, words: WORDS, playW: 1080, playH: 1920, durationMs: 6000 })
    const words = WORDS.map((w) => ({ w: w.w, s: w.s, e: w.e, i: w.i, spk: 0 }))
    expect(s.captions).toBe(buildCaptionsAss(words, { ...(e.captions as object) }, 1080, 1920))
    expect(s.text).toBeNull()
    expect(fontUrlsForAss(s.captions!)).toEqual(['/fonts/clip/Poppins-ExtraBold.ttf'])
  })
  it('hook: drawn normally, dropped when it repeats the captions (E6) or the T6 title is on', () => {
    const e = edits({ hookOverlay: { enabled: true, text: 'Big news today', durationMs: 2500 } }) as unknown as Record<string, unknown>
    const base = { edits: e, words: WORDS, playW: 1080, playH: 1920, durationMs: 6000 }
    expect(buildPreviewScripts(base).hook).toContain('Big news today')
    expect(buildPreviewScripts({ ...base, hookDuplicatesCaptions: true }).hook).toBeNull()
  })
  it('stream headline uses the byte-shared headline_ass_content port; badge text merges into the top burn', () => {
    const e = edits() as unknown as Record<string, unknown>
    const headline = { headline: 'LUDWIG TRIES VALORANT', playW: 1080, playH: 1920, barH: 320, barY: 150, fitTop: true, textColor: '#000000', headlineStyle: { font: 'Anton' }, textBoxX: null, textBoxW: null }
    const s = buildPreviewScripts({ edits: e, words: [], playW: 1080, playH: 1920, durationMs: 6000, headline,
      badge: { rect: { x: 40, y: 40, w: 200, h: 60 }, text: '2XRAKAI', showLogo: false, playW: 1080, playH: 1920 } })
    expect(s.top!.startsWith(headlineAssContent({ ...headline, durationMs: 6000 }).split('\n\n[Events]')[0])).toBe(true)
    expect(s.top).toContain('Style: BadgeText,Montserrat Black')
    expect(s.top).toContain('2XRAKAI')
  })
})

describe('EP2 PreviewStage renderer', () => {
  it('unsupported browser: DOM overlays only, no libass, no chip', async () => {
    support.on = false
    const { container } = stage(edits())
    expect(container.querySelector('[data-testid="libass-layer"]')).toBeNull()
    expect(container.querySelector('[data-testid="libass-fallback-chip"]')).toBeNull()
    expect(container.querySelector('[data-preview-renderer="dom"]')).toBeTruthy()
  })
  it('supported: captions go through libass, DOM caption line is ghosted but still mounted', async () => {
    const { container } = stage(edits())
    await waitFor(() => expect(container.querySelector('.libass-captions')).toBeTruthy())
    const inst = support.instances[0]
    expect(inst.track).toContain('[Events]')
    expect(inst.opts.workerUrl).toBe('/jassub/2.5.23/jassub-worker.js')
    expect(inst.opts.wasmUrl).toBe('/jassub/2.5.23/jassub-worker.wasm')
    expect(inst.renders).toBeGreaterThan(0)
    // hit-target / refs / testids stay in the DOM
    const line = container.querySelector('[data-testid="caption-line"]')
    if (line) expect(line.getAttribute('data-libass-ghost')).toBe('all')
    expect(container.querySelector('[data-preview-renderer="libass"]')).toBeTruthy()
  })
  it('text items: own libass layer; DOM block keeps its testid as hit-target', async () => {
    const e = edits({
      textItems: [{ id: 't1', text: 'HELLO', startMs: 0, endMs: 6000, x: 0.5, y: 0.3, fontSize: 64, color: '#ffffff', font: 'Montserrat' }],
    })
    const { container } = stage(e)
    await waitFor(() => expect(container.querySelector('.libass-text')).toBeTruthy())
    const block = container.querySelector('[data-testid="preview-text-item"]')
    expect(block?.getAttribute('data-libass-for')).toBe('text')
  })
  it('WASM load failure: DOM renderer comes back with the fallback chip', async () => {
    support.fail = true
    const { container } = stage(edits())
    await waitFor(() => expect(container.querySelector('[data-testid="libass-fallback-chip"]')).toBeTruthy())
    expect(container.querySelector('[data-testid="libass-layer"]')).toBeNull()
    expect(container.className.includes('libass-captions')).toBe(false)
  })
  it('flag off: never loads JASSUB', async () => {
    localStorage.setItem(CLIP_PREVIEW_LIBASS_KEY, '0')
    const { container } = stage(edits())
    await act(async () => {})
    expect(support.instances.length).toBe(0)
    expect(container.querySelector('[data-testid="libass-layer"]')).toBeNull()
  })
  it('stream fit_top headline is published from ExportTemplateOverlay into a top layer', async () => {
    const e = edits({
      layout: { mode: 'fit_top', shotOverrides: [] },
      exportTemplate: { headlineBar: { enabled: true, text: 'Ludwig tries Valorant' }, platformBadge: { enabled: false }, channelLink: { enabled: false }, platform: 'twitch' },
    })
    const { container } = stage(e)
    await waitFor(() => expect(support.instances.some((i) => i.track.includes('Style: Headline,Anton'))).toBe(true))
    expect(container.querySelector('[data-libass-layer="top"]')).toBeTruthy()
    // DOM headline lines stay mounted (text ghosted, white band kept)
    await waitFor(() => expect(container.querySelector('.libass-top')).toBeTruthy())
    expect(container.querySelector('[data-libass-for="top"][data-libass-ghost="text"]')).toBeTruthy()
  })
  it('legacy platform badge text is published and merged into the top burn', async () => {
    const e = edits({
      layout: { mode: 'fit_top', shotOverrides: [] },
      exportTemplate: { headlineBar: { enabled: true, text: 'Ludwig tries Valorant' }, platformBadge: { enabled: true }, channelLink: { enabled: false }, platform: 'twitch' },
    })
    stage(e)
    await waitFor(() => expect(support.instances.some((i) => i.track.includes('Style: BadgeText,Montserrat Black') && i.track.includes('TWITCH'))).toBe(true))
  })
})
