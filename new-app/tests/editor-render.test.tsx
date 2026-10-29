// @vitest-environment happy-dom
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'
import { CleanupPanel } from '@/components/clips/editor/cleanup-panel'
import { defaultEdits } from '@/lib/clips/edits'

vi.mock('@/components/clips/editor/trim-range-bar', () => ({
  TrimRangeBar: () => <div data-testid="trim-range-bar-mock" />,
}))

describe('CleanupPanel render', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders proposed/applied tabs without throwing', () => {
    const bounds = { clipStartMs: 0, clipEndMs: 60000 }
    const edits = defaultEdits(bounds)
    expect(() =>
      render(
        <CleanupPanel
          clipId="clip_test"
          bounds={bounds}
          edits={edits}
          words={[]}
          gapSettings={{ mode: 'more_than', minGapSec: 0.6, maxGapSec: 3, targetGapSec: 0.35 }}
          onApplyProposal={() => {}}
          onRestoreProposal={() => {}}
          onCommitTrim={() => {}}
          onAuditionChange={() => {}}
          onSeek={() => {}}
        />,
      ),
    ).not.toThrow()
  })
})
