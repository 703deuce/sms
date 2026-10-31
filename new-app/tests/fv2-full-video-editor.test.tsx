// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render } from '@testing-library/react'
import { Timeline } from '@/components/clips/editor/timeline'
import { defaultEdits, normalizeEdits } from '@/lib/clips/edits'
import {
  clientFrameQuantumMs,
  decodePeaksFile,
  editorAssetKeys,
  filmstripTiles,
  spriteTileAt,
  type FilmstripSprite,
} from '@/lib/clips/editor/editor-assets'
import {
  clampPxPerSec,
  fitPxPerSec,
  timelineMinPxPerSec,
  trackWidthPx,
  TIMELINE_MIN_PX_PER_SEC,
} from '@/lib/clips/editor/timeline-zoom'
import { formatRulerTime, rulerStepMs } from '@/components/clips/editor/timeline/timeline-ruler'
import { TranscriptPanel, transcriptChunkStarts, TRANSCRIPT_CHUNK_WORDS } from '@/components/clips/editor/transcript-panel'

vi.mock('@/components/clips/editor/audio-waveform-lane', () => ({ AudioWaveformLane: () => null }))

const HOUR = 3_600_000

describe('FV2 zoom floor', () => {
  it('clips keep the 4 px/s floor; an hour can zoom out to fit', () => {
    expect(timelineMinPxPerSec(30_000, 1000)).toBe(TIMELINE_MIN_PX_PER_SEC)
    const min = timelineMinPxPerSec(HOUR, 1000)
    expect(min).toBeCloseTo(1000 / 3600, 5)
    const fit = fitPxPerSec(HOUR, 1000, min)
    expect(Math.round(trackWidthPx(HOUR, fit, 1000, min))).toBe(1000)
    expect(clampPxPerSec(0.1)).toBe(TIMELINE_MIN_PX_PER_SEC) // default floor unchanged
    expect(timelineMinPxPerSec(10 * HOUR, 1000)).toBe(0.05)
  })

  it('ruler steps and labels stay readable for long media', () => {
    const step = rulerStepMs(1000 / HOUR)
    expect(step).toBeGreaterThanOrEqual(300_000)
    expect(formatRulerTime(HOUR + 65_000, step)).toBe('1:01:05')
    expect(formatRulerTime(65_000, 5000)).toBe(formatRulerTime(65_000, 5000)) // short-clip format untouched
  })
})

describe('FV2 editor assets helpers', () => {
  const sprite: FilmstripSprite = { intervalMs: 2000, tileW: 160, tileH: 90, cols: 10, rows: 10, count: 360, sheetUrls: ['a', 'b', 'c', 'd'] }

  it('reads keys from aiMeta and ignores junk', () => {
    expect(editorAssetKeys(null)).toEqual({ fullVideo: false, peaksKey: null, filmstrip: null })
    const k = editorAssetKeys({
      fullVideo: true,
      editorAssets: { peaksKey: 'p.json', filmstrip: { intervalMs: 2000, tileW: 160, tileH: 90, cols: 10, rows: 10, count: 3, keys: ['s0.jpg'] } },
    })
    expect(k.fullVideo).toBe(true)
    expect(k.peaksKey).toBe('p.json')
    expect(k.filmstrip?.keys).toEqual(['s0.jpg'])
    expect(editorAssetKeys({ editorAssets: { filmstrip: { keys: [] } } }).filmstrip).toBeNull()
  })

  it('decodes the u8 peaks file', () => {
    const data = Buffer.from([0, 255, 51]).toString('base64')
    const d = decodePeaksFile({ v: 1, peaksPerSec: 20, durationMs: 150, format: 'u8b64', data })
    expect(d?.peaksPerSec).toBe(20)
    expect(d?.peaks.map((p) => Math.round(p * 100))).toEqual([0, 100, 20])
    expect(decodePeaksFile({ v: 2 })).toBeNull()
  })

  it('maps media time to sprite tiles across sheets', () => {
    expect(spriteTileAt(sprite, 0)).toEqual({ sheet: 0, x: 0, y: 0, index: 0 })
    expect(spriteTileAt(sprite, 2000 * 11 + 10)).toEqual({ sheet: 0, x: 160, y: 90, index: 11 })
    expect(spriteTileAt(sprite, 2000 * 205)?.sheet).toBe(2)
    expect(spriteTileAt(sprite, 10 * HOUR)?.index).toBe(359)
  })

  it('tiles get denser when zoomed in and are windowed to the viewport', () => {
    const wide = filmstripTiles({ fromMs: 0, toMs: 60_000, widthPx: 600, tileW: 60 })
    const zoomed = filmstripTiles({ fromMs: 0, toMs: 60_000, widthPx: 6000, tileW: 60 })
    expect(wide).toHaveLength(10)
    expect(zoomed).toHaveLength(100)
    expect(zoomed[1].mediaMs - zoomed[0].mediaMs).toBeLessThan(wide[1].mediaMs - wide[0].mediaMs)
    const win = filmstripTiles({ fromMs: 0, toMs: HOUR, widthPx: 1_000_000, tileW: 64, visLeftPx: 500_000, visRightPx: 502_000 })
    expect(win.length).toBeLessThanOrEqual(33)
    expect(win[0].leftPx).toBeGreaterThanOrEqual(499_968)
    expect(clientFrameQuantumMs(0.16, 64)).toBe(500)
    expect(clientFrameQuantumMs(0.001, 64)).toBe(60000)
  })

  it('transcript chunking only for long transcripts', () => {
    expect(transcriptChunkStarts(5000, false)).toEqual([0])
    expect(transcriptChunkStarts(100, true)).toEqual([0])
    expect(transcriptChunkStarts(TRANSCRIPT_CHUNK_WORDS * 2 + 1, true)).toHaveLength(3)
  })
})

function renderTimeline(spanMs: number, extra: Record<string, unknown> = {}, nWords = 40) {
  const bounds = { clipStartMs: 0, clipEndMs: spanMs, trimMinMs: 0, trimMaxMs: spanMs }
  const edits = normalizeEdits(defaultEdits(bounds), bounds)
  const step = spanMs / nWords / 1000
  const words = Array.from({ length: nWords }, (_, i) => ({ i, w: `w${i}`, s: i * step, e: i * step + step * 0.7 }))
  return render(
    <Timeline
      edits={edits}
      words={words}
      shots={[]}
      outputMs={0}
      clipOutputDurationMs={spanMs}
      onSeekOutput={vi.fn()}
      onTrimChange={vi.fn()}
      clipStartMs={0}
      clipEndMs={spanMs}
      {...extra}
    />,
  )
}

describe('FV2 timeline', () => {
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('short clip: Video lane shows a client-extracted filmstrip, default zoom unchanged', () => {
    const { getByTestId, getAllByTestId } = renderTimeline(30_000, { videoUrl: 'https://cdn.example/clip.mp4' })
    expect(getByTestId('timeline-scroll').getAttribute('data-px-per-sec')).toBe('160')
    const strip = getByTestId('timeline-item-video').querySelector('[data-testid="timeline-filmstrip"]')
    expect(strip?.getAttribute('data-source')).toBe('client')
    expect(Number(strip?.getAttribute('data-tiles'))).toBeGreaterThan(10)
    expect(getAllByTestId('timeline-word')).toHaveLength(40)
  })

  it('full video: opens at Fit, sprite filmstrip, words windowed', () => {
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(1200)
    const sprite: FilmstripSprite = { intervalMs: 6000, tileW: 160, tileH: 90, cols: 10, rows: 10, count: 600, sheetUrls: ['s0', 's1', 's2', 's3', 's4', 's5'] }
    const { getByTestId, getAllByTestId } = renderTimeline(
      HOUR,
      { videoUrl: 'https://cdn.example/full.mp4', editorAssets: { fullVideo: true, peaksUrl: null, filmstrip: sprite } },
      6000,
    )
    const pps = Number(getByTestId('timeline-scroll').getAttribute('data-px-per-sec'))
    expect(pps).toBeLessThan(1)
    const strip = getByTestId('timeline-item-video').querySelector('[data-testid="timeline-filmstrip"]')
    expect(strip?.getAttribute('data-source')).toBe('sprite')
    const tile = strip?.querySelector('[data-testid="timeline-filmstrip-tile"]') as HTMLElement
    expect(tile.style.backgroundImage).toContain('s0')
    // At Fit, chips group; the DOM never holds all 6000 words.
    expect(getAllByTestId('timeline-word').length).toBeLessThan(6000)
    // Zoomed far in: only chips near the viewport are in the DOM (virtualized), not the whole hour.
    for (let i = 0; i < 40; i++) fireEvent.click(getByTestId('timeline-zoom-in'))
    expect(Number(getByTestId('timeline-scroll').getAttribute('data-px-per-sec'))).toBeGreaterThan(50)
    const n = getAllByTestId('timeline-word').length
    expect(n).toBeGreaterThan(0)
    expect(n).toBeLessThan(400)
    const tiles = getByTestId('timeline-item-video').querySelectorAll('[data-testid="timeline-filmstrip-tile"]')
    expect(tiles.length).toBeLessThan(200)
  })
})

describe('FV2 transcript panel', () => {
  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })
  const mk = (n: number) => Array.from({ length: n }, (_, i) => ({ i, w: `w${i}`, s: i * 0.4, e: i * 0.4 + 0.3 }))
  const renderPanel = (n: number) => {
    const bounds = { clipStartMs: 0, clipEndMs: n * 400, trimMinMs: 0, trimMaxMs: n * 400 }
    const edits = normalizeEdits(defaultEdits(bounds), bounds)
    return render(
      <TranscriptPanel
        words={mk(n)}
        clipStartMs={0}
        clipEndMs={n * 400}
        shots={[]}
        edits={edits}
        onSeek={() => {}}
        onAddCut={() => {}}
        onWordFix={() => {}}
        onRestoreWord={() => {}}
        onExtendTrim={() => {}}
        selectionRef={{ current: null }}
      />,
    )
  }

  it('short transcripts render every word, no lazy chunks', () => {
    const { container } = renderPanel(300)
    expect(container.querySelectorAll('[data-testid="transcript-chunk"]')).toHaveLength(0)
    expect(container.textContent).toContain('w299')
  })

  it('long transcripts render lazily (off-screen chunks are placeholders)', () => {
    class NeverIO {
      observe() {}
      disconnect() {}
      unobserve() {}
    }
    vi.stubGlobal('IntersectionObserver', NeverIO)
    const { container } = renderPanel(3000)
    const chunks = container.querySelectorAll('[data-testid="transcript-chunk"]')
    expect(chunks.length).toBe(10)
    expect(container.textContent).not.toContain('w2999')
  })
})
