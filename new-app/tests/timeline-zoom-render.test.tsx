// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render } from '@testing-library/react'
import { Timeline } from '@/components/clips/editor/timeline'
import { defaultEdits, normalizeEdits } from '@/lib/clips/edits'

vi.mock('@/components/clips/editor/audio-waveform-lane', () => ({
  AudioWaveformLane: () => null,
}))

const bounds = { clipStartMs: 0, clipEndMs: 30000, trimMinMs: 0, trimMaxMs: 60000 }
// ClipWord times are in SECONDS (w.s / w.e)
const words = Array.from({ length: 40 }, (_, i) => ({ i, w: `word${i}`, s: i * 0.6, e: i * 0.6 + 0.4 }))

function renderTimeline(outputMs = 0) {
  const edits = normalizeEdits(defaultEdits(bounds), bounds)
  return render(
    <Timeline
      edits={edits}
      words={words}
      shots={[]}
      outputMs={outputMs}
      clipOutputDurationMs={30000}
      onSeekOutput={vi.fn()}
      onTrimChange={vi.fn()}
      clipStartMs={bounds.clipStartMs}
      clipEndMs={bounds.clipEndMs}
    />,
  )
}

describe('Timeline zoom controls (E1)', () => {
  afterEach(() => cleanup())

  it('renders zoom controls at the readable default (100%)', () => {
    const { getByTestId } = renderTimeline()
    expect(getByTestId('timeline-zoom-controls')).toBeTruthy()
    expect(getByTestId('timeline-zoom-label').textContent).toBe('100%')
    expect(getByTestId('timeline-scroll').getAttribute('data-px-per-sec')).toBe('160')
  })

  it('zoom in / out change px per second and the track width', () => {
    const { getByTestId } = renderTimeline()
    const track = getByTestId('timeline-track')
    const w0 = parseFloat(track.style.width)
    fireEvent.click(getByTestId('timeline-zoom-in'))
    expect(getByTestId('timeline-scroll').getAttribute('data-px-per-sec')).toBe('200')
    expect(parseFloat(getByTestId('timeline-track').style.width)).toBeGreaterThan(w0)
    fireEvent.click(getByTestId('timeline-zoom-out'))
    fireEvent.click(getByTestId('timeline-zoom-out'))
    expect(getByTestId('timeline-scroll').getAttribute('data-px-per-sec')).toBe('128')
  })

  it('+ / - keys zoom when the timeline has focus', () => {
    const { getByTestId } = renderTimeline()
    const scroll = getByTestId('timeline-scroll')
    fireEvent.keyDown(scroll, { key: '+' })
    expect(scroll.getAttribute('data-px-per-sec')).toBe('200')
    fireEvent.keyDown(scroll, { key: '-' })
    expect(scroll.getAttribute('data-px-per-sec')).toBe('160')
  })

  it('word chips show readable labels at default zoom (not just the first letter)', () => {
    const { getAllByTestId } = renderTimeline()
    const chips = getAllByTestId('timeline-word')
    expect(chips.length).toBeGreaterThan(10)
    // 400ms at 160px/s = 64px -> full label rendered
    expect(chips[0].textContent?.toLowerCase()).toContain('word0')
  })

  it('draws the playhead in source space', () => {
    const { getByTestId } = renderTimeline(15000)
    const left = parseFloat(getByTestId('timeline-playhead').style.left)
    expect(left).toBeGreaterThan(40)
    expect(left).toBeLessThan(60)
  })
})
