// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { Timeline } from '@/components/clips/editor/timeline'
import { defaultEdits, normalizeEdits } from '@/lib/clips/edits'
import {
  TIMELINE_DEFAULT_PX_PER_SEC,
  TIMELINE_READABLE_MAX_PX_PER_SEC,
  initialPxPerSec,
  isTextEntryTarget,
  readablePxPerSec,
  timelineZoomKeyAction,
  wordLabelWidthPx,
} from '@/lib/clips/editor/timeline-zoom'

vi.mock('@/components/clips/editor/audio-waveform-lane', () => ({
  AudioWaveformLane: () => null,
}))

const bounds = { clipStartMs: 0, clipEndMs: 30000, trimMinMs: 0, trimMaxMs: 60000 }
const words = Array.from({ length: 40 }, (_, i) => ({ i, w: `word${i}`, s: i * 0.6, e: i * 0.6 + 0.4 }))

function renderTimeline(extra?: React.ReactNode) {
  const edits = normalizeEdits(defaultEdits(bounds), bounds)
  return render(
    <div>
      {extra}
      <Timeline
        edits={edits}
        words={words}
        shots={[]}
        outputMs={0}
        clipOutputDurationMs={30000}
        onSeekOutput={vi.fn()}
        onTrimChange={vi.fn()}
        clipStartMs={bounds.clipStartMs}
        clipEndMs={bounds.clipEndMs}
      />
    </div>,
  )
}

describe('E1fix bug 6: +/-/0 zoom keys work without focusing the timeline', () => {
  afterEach(() => cleanup())

  it('keys on the page body zoom the timeline', () => {
    const { getByTestId } = renderTimeline()
    const scroll = getByTestId('timeline-scroll')
    act(() => {
      fireEvent.keyDown(document.body, { key: '+' })
    })
    expect(scroll.getAttribute('data-px-per-sec')).toBe('200')
    act(() => {
      fireEvent.keyDown(document.body, { key: '-' })
    })
    expect(scroll.getAttribute('data-px-per-sec')).toBe('160')
    act(() => {
      fireEvent.keyDown(document.body, { key: '=' })
    })
    expect(scroll.getAttribute('data-px-per-sec')).toBe('200')
  })

  it('focused timeline zooms exactly once per key (no double handling)', () => {
    const { getByTestId } = renderTimeline()
    const scroll = getByTestId('timeline-scroll')
    fireEvent.keyDown(scroll, { key: '+' })
    expect(scroll.getAttribute('data-px-per-sec')).toBe('200')
  })

  it('typing in a text input / textarea / contentEditable does not zoom', () => {
    const { getByTestId } = renderTimeline(
      <>
        <input data-testid="txt" />
        <textarea data-testid="ta" />
        <div data-testid="ce" contentEditable suppressContentEditableWarning>
          x
        </div>
      </>,
    )
    const scroll = getByTestId('timeline-scroll')
    fireEvent.keyDown(getByTestId('txt'), { key: '+' })
    fireEvent.keyDown(getByTestId('ta'), { key: '-' })
    fireEvent.keyDown(getByTestId('ce'), { key: '0' })
    expect(scroll.getAttribute('data-px-per-sec')).toBe('160')
  })

  it('Ctrl/Cmd +/-/0 is left to the browser', () => {
    const { getByTestId } = renderTimeline()
    const scroll = getByTestId('timeline-scroll')
    fireEvent.keyDown(document.body, { key: '+', ctrlKey: true })
    fireEvent.keyDown(document.body, { key: '-', metaKey: true })
    expect(scroll.getAttribute('data-px-per-sec')).toBe('160')
  })

  it('pure helpers', () => {
    expect(timelineZoomKeyAction({ key: '+' })).toBe('in')
    expect(timelineZoomKeyAction({ key: '_' })).toBe('out')
    expect(timelineZoomKeyAction({ key: '0' })).toBe('fit')
    expect(timelineZoomKeyAction({ key: '0', ctrlKey: true })).toBeNull()
    expect(timelineZoomKeyAction({ key: 'a' })).toBeNull()
    const range = document.createElement('input')
    range.type = 'range'
    expect(isTextEntryTarget(range)).toBe(false)
    expect(isTextEntryTarget(document.createElement('input'))).toBe(true)
    expect(isTextEntryTarget(document.body)).toBe(false)
    expect(isTextEntryTarget(null)).toBe(false)
  })
})

describe('E1fix bug 5: default zoom fits typical words', () => {
  it('readable scale covers 75% of words, clamped to [default, max]', () => {
    // live clip: ~250–300 ms words like "energy," / "capital," (7–8 chars)
    const live = [
      { text: 'energy,', durMs: 280 },
      { text: 'capital,', durMs: 300 },
      { text: 'whatever', durMs: 320 },
      { text: 'of', durMs: 120 },
      { text: 'the', durMs: 150 },
      { text: 'effort,', durMs: 260 },
    ]
    const px = readablePxPerSec(live)
    expect(px).toBeGreaterThan(TIMELINE_DEFAULT_PX_PER_SEC)
    expect(px).toBeLessThanOrEqual(TIMELINE_READABLE_MAX_PX_PER_SEC)
    // at that scale a 280 ms "energy," gets its full label width
    expect((280 / 1000) * px).toBeGreaterThanOrEqual(wordLabelWidthPx('energy,') - 1)
    expect(readablePxPerSec([])).toBe(TIMELINE_DEFAULT_PX_PER_SEC)
    expect(readablePxPerSec([{ text: 'a', durMs: 2000 }])).toBe(TIMELINE_DEFAULT_PX_PER_SEC)
  })

  it('initial zoom uses the readable scale; short clips still fit', () => {
    expect(initialPxPerSec(30_000, 900, 240)).toBe(240)
    expect(initialPxPerSec(2_000, 900, 240)).toBe(450)
  })
})
