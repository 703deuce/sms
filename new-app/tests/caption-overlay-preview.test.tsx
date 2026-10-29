// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { CaptionOverlay } from '@/components/clips/editor/caption-overlay'
import { defaultEdits, type ClipWord } from '@/lib/clips/edits'

const bounds = { clipStartMs: 0, clipEndMs: 10_000 }

describe('caption preview overlay', () => {
  it('renders progress bar when progressBar.enabled is true', () => {
    const edits = defaultEdits(bounds)
    edits.captions = {
      ...edits.captions,
      progressBar: { enabled: true, color: '#ff00ff', position: 'bottom', thickness: 8 },
    }
    const words: ClipWord[] = [{ w: 'hello', s: 0, e: 1, idx: 0 }]
    render(
      <CaptionOverlay
        words={words}
        currentTimeSec={0.5}
        edits={edits}
        boxHeightPx={320}
        outputDurationSec={5}
      />,
    )
    expect(screen.getByTestId('caption-progress-bar')).toBeTruthy()
  })

  it('renders emoji on active word when autoEmojis and emojiByWord set', () => {
    const edits = defaultEdits(bounds)
    edits.captions = {
      ...edits.captions,
      autoEmojis: true,
      emojiByWord: { '0': '🔥' },
    }
    const words: ClipWord[] = [{ w: 'hello', s: 0, e: 1, i: 0, idx: 0 }]
    render(
      <CaptionOverlay
        words={words}
        currentTimeSec={0.5}
        edits={edits}
        boxHeightPx={320}
        outputDurationSec={5}
      />,
    )
    expect(screen.getByTestId('caption-floating-emoji').textContent).toContain('🔥')
  })

  it('renders highlight style on active word', () => {
    const edits = defaultEdits(bounds)
    edits.captions = {
      ...edits.captions,
      activeStyle: 'highlight',
      highlightColor: '#FDE047',
    }
    const words: ClipWord[] = [
      { w: 'one', s: 0, e: 0.5, idx: 0 },
      { w: 'two', s: 0.5, e: 1, idx: 1 },
    ]
    const { container } = render(
      <CaptionOverlay words={words} currentTimeSec={0.6} edits={edits} boxHeightPx={320} outputDurationSec={5} />,
    )
    const active = container.querySelector('span[style*="background"]')
    expect(active).toBeTruthy()
  })

  it('applies speaker-1 hex at t=0 while paused before first word', () => {
    const edits = defaultEdits(bounds)
    edits.captions = {
      ...edits.captions,
      colors: { a: '#00ff00' },
    }
    const words: ClipWord[] = [{ w: 'hello', s: 0.5, e: 1, idx: 0 }]
    const { container } = render(
      <CaptionOverlay words={words} currentTimeSec={0} edits={edits} boxHeightPx={320} outputDurationSec={5} />,
    )
    const span = container.querySelector('span')
    expect(span?.getAttribute('style')).toContain('#00ff00')
  })

  it('uses caption font override in preview', () => {
    const edits = defaultEdits(bounds)
    edits.captions = { ...edits.captions, font: 'Anton' }
    const words: ClipWord[] = [{ w: 'hello', s: 0, e: 1, idx: 0 }]
    const { container } = render(
      <CaptionOverlay words={words} currentTimeSec={0.2} edits={edits} boxHeightPx={320} outputDurationSec={5} />,
    )
    const row = container.querySelector('[style*="font-family"]') as HTMLElement | null
    expect(row?.style.fontFamily).toContain('Anton')
  })
})
