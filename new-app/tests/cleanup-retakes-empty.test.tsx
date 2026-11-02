// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import { defaultEdits, normalizeEdits } from '@/lib/clips/edits'
import { CleanupPanel } from '@/components/clips/editor/cleanup-panel'
import { clipsFetch } from '@/lib/clips-api'
import { toast } from 'sonner'

vi.mock('@/lib/clips-api', () => ({
  clipsFetch: vi.fn(() => Promise.resolve({})),
  retranscribeProject: vi.fn(() => Promise.resolve({ ok: true, jobId: 'j1', status: 'QUEUED' })),
}))

vi.mock('sonner', () => ({
  toast: { message: vi.fn(), success: vi.fn(), error: vi.fn() },
}))

const bounds = { clipStartMs: 0, clipEndMs: 20_000, trimMinMs: 0, trimMaxMs: 40_000 }
const words = [{ i: 0, w: 'hello', s: 1, e: 1.4 }]

describe('cleanup retakes empty message', () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('shows No retakes found when findRetakes returns nothing', async () => {
    const edits = normalizeEdits(defaultEdits(bounds), bounds)
    const { getByTestId } = render(
      <CleanupPanel
        clipId="clip1"
        projectId="proj1"
        bounds={bounds}
        edits={edits}
        words={words}
        gapSettings={{ mode: 'more_than', minGapSec: 0.6, maxGapSec: 3, targetGapSec: 0.35 }}
        onApplyProposal={vi.fn()}
        onRestoreProposal={vi.fn()}
        onCommitTrim={vi.fn()}
        onAuditionChange={vi.fn()}
        onSeek={vi.fn()}
      />,
    )
    fireEvent.click(getByTestId('retake-run'))
    await waitFor(() => expect(toast.message).toHaveBeenCalledWith('No retakes found'))
  })
})
