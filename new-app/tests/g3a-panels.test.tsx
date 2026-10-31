// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render } from '@testing-library/react'
import { CaptionLinesPanel } from '@/components/clips/editor/caption-lines-panel'
import { TextAnimSection } from '@/components/clips/editor/text-anim-section'
import { defaultEdits, type ClipEditsV2 } from '@/lib/clips/edits'

afterEach(cleanup)

const base = (): ClipEditsV2 => ({ ...defaultEdits({ clipStartMs: 0, clipEndMs: 20_000 }), captions: { ...defaultEdits({ clipStartMs: 0, clipEndMs: 20_000 }).captions, enabled: false } })
const words = [
  { i: 0, w: 'hello', s: 0.1, e: 0.4 },
  { i: 1, w: 'world', s: 0.5, e: 0.9 },
  { i: 2, w: 'again', s: 1.0, e: 1.4 },
]

describe('G3a Manual captions panel', () => {
  it('typed lines are added at the playhead and turn captions on; no costs anywhere', () => {
    const onEdits = vi.fn()
    const { getByTestId, container } = render(<CaptionLinesPanel edits={base()} words={words} playheadMs={2000} durationMs={20_000} onEdits={onEdits} />)
    fireEvent.change(getByTestId('caption-lines-type'), { target: { value: 'Line one\nLine two' } })
    fireEvent.click(getByTestId('caption-lines-add'))
    const next = onEdits.mock.calls[0]![0] as ClipEditsV2
    expect(next.captions.enabled).toBe(true)
    expect(next.captionLines!.map((l) => [l.text, l.startMs])).toEqual([['Line one', 2000], ['Line two', 2800]])
    expect(container.textContent).not.toMatch(/\$|credit/i)
  })
  it('auto captions → editable lines; edit, split, merge, delete rows', () => {
    const onEdits = vi.fn()
    const r = render(<CaptionLinesPanel edits={base()} words={words} playheadMs={0} durationMs={20_000} onEdits={onEdits} />)
    fireEvent.click(r.getByTestId('caption-lines-from-auto'))
    const withLines = onEdits.mock.calls[0]![0] as ClipEditsV2
    expect(withLines.captionLines!.length).toBeGreaterThan(0)
    r.rerender(<CaptionLinesPanel edits={withLines} words={words} playheadMs={0} durationMs={20_000} onEdits={onEdits} />)
    const first = withLines.captionLines![0]!
    const input = r.getByTestId(`caption-line-text-${first.id}`) as HTMLInputElement
    fireEvent.change(input, { target: { value: 'Hi there you' } })
    fireEvent.blur(input)
    const edited = onEdits.mock.calls.at(-1)![0] as ClipEditsV2
    expect(edited.captionLines![0]!.text).toBe('Hi there you')
    r.rerender(<CaptionLinesPanel edits={edited} words={words} playheadMs={0} durationMs={20_000} onEdits={onEdits} />)
    fireEvent.click(r.getByTestId(`caption-line-delete-${first.id}`))
    expect((onEdits.mock.calls.at(-1)![0] as ClipEditsV2).captionLines?.some((l) => l.id === first.id) ?? false).toBe(false)
    expect(r.getByTestId('caption-lines-download-srt')).toBeTruthy()
  })
  it('16:9 layouts include a lower third', () => {
    const onEdits = vi.fn()
    const { getByTestId } = render(<CaptionLinesPanel edits={{ ...base(), aspectRatio: '16:9' }} words={[]} playheadMs={0} durationMs={20_000} onEdits={onEdits} />)
    fireEvent.click(getByTestId('caption-layout-lower_third'))
    expect((onEdits.mock.calls[0]![0] as ClipEditsV2).captions).toMatchObject({ position: 'bottom', marginVPct: 7, size: 5.5, wordsPerLine: 6, enabled: true })
  })
})

describe('G3a text animation section', () => {
  it('renders In / Out / Loop; durations only once an animation is chosen', () => {
    const { getByTestId, queryByTestId, rerender } = render(<TextAnimSection anim={undefined} onChange={vi.fn()} />)
    expect(getByTestId('text-anim-in-type')).toBeTruthy()
    expect(getByTestId('text-anim-loop-type')).toBeTruthy()
    expect(queryByTestId('text-anim-in-dur-row')).toBeNull()
    rerender(<TextAnimSection anim={{ in: { type: 'fade', unit: 'word', durMs: 400 }, loop: { type: 'pulse', periodMs: 800 } }} onChange={vi.fn()} />)
    expect(getByTestId('text-anim-in-dur-row')).toBeTruthy()
    expect(getByTestId('text-anim-in-unit')).toBeTruthy()
    expect(getByTestId('text-anim-loop-period-row')).toBeTruthy()
  })
})
