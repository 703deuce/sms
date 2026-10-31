// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { Timeline } from '@/components/clips/editor/timeline'
import { defaultEdits, normalizeEdits } from '@/lib/clips/edits'

vi.mock('@/components/clips/editor/audio-waveform-lane', () => ({ AudioWaveformLane: () => null }))

const bounds = { clipStartMs: 0, clipEndMs: 30_000, trimMinMs: 0, trimMaxMs: 30_000 }
const words = Array.from({ length: 20 }, (_, i) => ({ i, w: `w${i}`, s: i * 1.5, e: i * 1.5 + 1 }))

function renderWithSources(sourceUrls: Record<string, string> | null) {
  const edits = normalizeEdits(
    {
      ...defaultEdits(bounds),
      sources: [
        { id: 'up1', ref: 'upload', refId: 'up1', mediaType: 'video', label: 'Cam B', durationMs: 60_000 },
        { id: 'img1', ref: 'upload', refId: 'img1', mediaType: 'image', label: 'Logo' },
      ],
      sourceSegments: [
        { id: 'seg1', sourceId: 'up1', startMs: 5_000, endMs: 10_000, inMs: 20_000 },
        { id: 'seg2', sourceId: 'img1', startMs: 15_000, endMs: 18_000 },
      ],
    },
    bounds,
  )
  return render(
    <Timeline
      edits={edits}
      words={words}
      shots={[]}
      outputMs={0}
      clipOutputDurationMs={30_000}
      videoUrl="https://cdn.example/main.mp4"
      sourceUrls={sourceUrls}
      onSeekOutput={vi.fn()}
      onTrimChange={vi.fn()}
      clipStartMs={0}
      clipEndMs={30_000}
    />,
  )
}

describe('E5×FV2 other-source filmstrip', () => {
  afterEach(() => cleanup())

  it('each other-source span uses its own media URL and media times', () => {
    const { getAllByTestId } = renderWithSources({ up1: 'https://cdn.example/camb.mp4', img1: 'https://cdn.example/logo.png' })
    const strips = getAllByTestId('timeline-source-filmstrip')
    expect(strips.map((s) => s.getAttribute('data-source-url'))).toEqual([
      'https://cdn.example/camb.mp4',
      'https://cdn.example/logo.png',
    ])
    const tiles = strips[0]!.querySelectorAll('[data-testid="timeline-filmstrip-tile"]')
    const first = Number(tiles[0]!.getAttribute('data-media-ms'))
    expect(first).toBeGreaterThanOrEqual(20_000) // media in-point, not main-source time
    expect(first).toBeLessThan(25_000)
    expect(strips[0]!.querySelector('[data-testid="timeline-filmstrip"]')?.getAttribute('data-source')).toBe('client')
    expect(strips[1]!.querySelector('[data-testid="timeline-filmstrip"]')?.getAttribute('data-source')).toBe('still')
    // the source chips (E5) are still there
    expect(getAllByTestId('timeline-source-segment')).toHaveLength(2)
  })

  it('no URL yet → no wrong (main-video) frames over the span', () => {
    const { getAllByTestId } = renderWithSources(null)
    const strips = getAllByTestId('timeline-source-filmstrip')
    expect(strips).toHaveLength(2)
    for (const s of strips) expect(s.querySelector('[data-testid="timeline-filmstrip-tile"]')).toBeNull()
  })
})
