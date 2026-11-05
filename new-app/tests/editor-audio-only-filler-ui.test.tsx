// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import { CleanupPanel } from '@/components/clips/editor/cleanup-panel'
import { defaultEdits, outputDurationMs } from '@/lib/clips/edits'

afterEach(cleanup)
const bounds = { clipStartMs: 0, clipEndMs: 4000, trimMinMs: 0, trimMaxMs: 4000 }
const words = [
  { i: 0, w: 'hello', s: 0.2, e: 0.45 },
  { i: 1, w: 'um', s: 0.65, e: 0.9, isFiller: true, fillerKind: 'lexicon' },
  { i: 2, w: 'there', s: 1.1, e: 1.4 },
]
describe('audio-only cleanup UI', () => {
  it('defaults to preserving video, commits an undoable speech mute and can restore audio', async () => {
    const edits = defaultEdits(bounds)
    const onCommitEdits = vi.fn()
    const props = {
      clipId: 'clip_audio_only', projectId: 'project_a', bounds, edits,
      words: words as never,
      gapSettings: { mode: 'all' as const, minGapSec: 0.4, maxGapSec: 2, targetGapSec: 0.12 },
      onApplyProposal: vi.fn(), onRestoreProposal: vi.fn(),
      onCommitTrim: vi.fn(), onAuditionChange: vi.fn(), onSeek: vi.fn(),
      onCommitEdits,
    }
    const ui = render(<CleanupPanel {...props} />)
    expect(ui.getByTestId('filler-mode-audio').getAttribute('data-state')).not.toBe('disabled')
    const buttons = ui.getAllByRole('button', { name: 'Apply', exact: true })
    expect(buttons.length).toBeGreaterThan(0)
    fireEvent.click(buttons[0]!)
    await waitFor(() => expect(onCommitEdits).toHaveBeenCalled())
    const next = onCommitEdits.mock.calls[0][0]
    expect(next.cutRanges).toEqual([])
    expect(next.audioMuteRanges).toHaveLength(1)
    expect(outputDurationMs(next)).toBe(outputDurationMs(edits))
    expect(onCommitEdits.mock.calls[0][1]).toContain('video kept')

    ui.rerender(<CleanupPanel {...props} edits={next} />)
    fireEvent.click(ui.getByRole('tab', { name: /Applied/ }))
    expect(ui.getByTestId('audio-only-fillers-applied')).toBeTruthy()
    fireEvent.click(ui.getByTestId('restore-audio-only-fillers'))
    expect(onCommitEdits.mock.calls.at(-1)?.[0].audioMuteRanges).toEqual([])
  })
})
