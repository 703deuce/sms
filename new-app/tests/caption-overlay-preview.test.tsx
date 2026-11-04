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

  it('uses speaker active color for highlight box background', () => {
    const edits = defaultEdits(bounds)
    edits.captions = {
      ...edits.captions,
      activeStyle: 'highlight',
      colors: { a: '#00ff00' },
      highlightColor: '#FDE047',
    }
    const words: ClipWord[] = [{ w: 'hello', s: 0, e: 1, idx: 0 }]
    const { container } = render(
      <CaptionOverlay words={words} currentTimeSec={0.2} edits={edits} boxHeightPx={320} outputDurationSec={5} />,
    )
    const active = container.querySelector('span[style*="background"]') as HTMLElement | null
    const style = active?.getAttribute('style') ?? ''
    expect(style.toLowerCase()).toMatch(/#00ff00|rgb\(0,\s*255,\s*0\)/)
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
  it('scales caption font visibly from 3% to 10% at laptop preview height (E8)', () => {
    const words: ClipWord[] = [{ w: 'hello', s: 0, e: 1, idx: 0 }]
    const small = defaultEdits(bounds)
    small.captions = { ...small.captions, size: 3 }
    const one = render(
      <CaptionOverlay words={words} currentTimeSec={0.2} edits={small} boxHeightPx={200} outputDurationSec={5} />,
    )
    const smallPx = parseFloat((one.getByTestId('caption-row') as HTMLElement).style.fontSize)
    one.unmount()
    const large = defaultEdits(bounds)
    large.captions = { ...large.captions, size: 10 }
    const two = render(
      <CaptionOverlay words={words} currentTimeSec={0.2} edits={large} boxHeightPx={200} outputDurationSec={5} />,
    )
    const largePx = parseFloat((two.getByTestId('caption-row') as HTMLElement).style.fontSize)
    expect(largePx).toBeGreaterThan(smallPx * 2)
  })

})
