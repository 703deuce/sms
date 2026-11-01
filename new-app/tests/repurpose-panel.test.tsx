// @vitest-environment happy-dom
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { RepurposePanel } from '@/components/clips/editor/repurpose-panel'
import { defaultEdits, normalizeEdits, type ClipEditsV2 } from '@/lib/clips/edits'
import { formatYoutubeChapters } from '@/lib/clips/repurpose'

vi.mock('@/components/clips/clip-post-copy', () => ({
  ClipPostCopy: () => <div data-testid="post-copy-mock" />,
}))

vi.mock('@/lib/clips-api', () => ({
  clipsFetch: vi.fn(),
}))

describe('RepurposePanel', () => {
  const bounds = { clipStartMs: 0, clipEndMs: 30_000 }
  const shortEdits = normalizeEdits(defaultEdits(bounds), bounds)

  const longBounds = { clipStartMs: 0, clipEndMs: 180_000 }
  const longEdits = normalizeEdits(defaultEdits(longBounds), longBounds)

  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('navigator', {
      ...navigator,
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    })
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it('shows under 2 min message', () => {
    render(<RepurposePanel clipId="c1" edits={shortEdits} onCommitEdits={vi.fn()} />)
    expect(screen.getByText(/at least 2 minutes/i)).toBeTruthy()
  })

  it('shows stale badge when edits hash differs', () => {
    render(
      <RepurposePanel
        clipId="c1"
        edits={longEdits}
        aiMeta={{ repurpose: { editsHash: 'old-hash', chapters: [{ outMs: 0, label: 'Intro' }] } }}
        onCommitEdits={vi.fn()}
      />,
    )
    expect(screen.getByText(/Edits changed since these were generated/i)).toBeTruthy()
  })

  it('Copy for YouTube writes formatted chapters', async () => {
    const chapters = [
      { outMs: 0, label: 'Intro' },
      { outMs: 65_000, label: 'Main' },
    ]
    render(
      <RepurposePanel
        clipId="c1"
        edits={longEdits}
        aiMeta={{ repurpose: { chapters, editsHash: 'x' } }}
        onCommitEdits={vi.fn()}
      />,
    )
    fireEvent.click(screen.getAllByTestId('repurpose-chapters-copy-yt').find((el) => !(el as HTMLButtonElement).disabled)!)
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(formatYoutubeChapters(chapters))
  })

  it('Add as markers commits once', () => {
    const onCommit = vi.fn()
    const chapters = [{ outMs: 1000, label: 'A' }]
    render(
      <RepurposePanel
        clipId="c1"
        edits={longEdits}
        aiMeta={{ repurpose: { chapters } }}
        onCommitEdits={onCommit}
      />,
    )
    fireEvent.click(screen.getAllByTestId('repurpose-chapters-markers').find((el) => !(el as HTMLButtonElement).disabled)!)
    expect(onCommit).toHaveBeenCalledTimes(1)
    const next = onCommit.mock.calls[0][0] as ClipEditsV2
    expect(next.markers?.length).toBeGreaterThan(0)
  })
})
