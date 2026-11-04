// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { defaultEdits } from '@/lib/clips/edits'
import { ClipFillerReview } from '@/components/clips/editor/clip-filler-review'

afterEach(cleanup)

describe('D4 filler review lifecycle', () => {
  const words = [
    { i: 0, w: 'um', s: 0.1, e: 0.4 },
    { i: 1, w: 'hello', s: 0.5, e: 1.2 },
  ]
  it('stays closed until explicitly opened; Escape closes it in capture phase', () => {
    const onOpenChange = vi.fn()
    const props = {
      clipId: 'd4_review', words,
      edits: defaultEdits({ clipStartMs: 0, clipEndMs: 12000 }),
      onOpenChange, onApplyProposal: vi.fn(), onSeek: vi.fn(),
    }
    const ui = render(<ClipFillerReview {...props} open={false} />)
    expect(ui.queryByTestId('script-filler-review-bar')).toBeNull()
    ui.rerender(<ClipFillerReview {...props} open />)
    expect(ui.getByTestId('script-filler-review-bar')).toBeTruthy()
    act(() => fireEvent.keyDown(window, { key: 'Escape' }))
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('does not drive media seeking while video plays even when the review is visible', () => {
    const onSeek = vi.fn()
    const props = {
      clipId: 'd4_playing', words,
      edits: defaultEdits({ clipStartMs: 0, clipEndMs: 12000 }),
      onOpenChange: vi.fn(), onApplyProposal: vi.fn(), onSeek,
    }
    const ui = render(<ClipFillerReview {...props} open playing />)
    expect(ui.getByTestId('script-filler-review-bar')).toBeTruthy()
    expect(onSeek).not.toHaveBeenCalled()
  })
})
