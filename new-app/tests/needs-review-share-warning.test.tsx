// @vitest-environment happy-dom
// @ts-ignore — vitest is resolved in new-app; root tsc has no vitest types
import { afterEach, describe, expect, it, vi } from 'vitest'
// @ts-ignore — testing-library is resolved in new-app; root tsc cannot see it
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { ExportRenderShareDialog } from '../components/clips/export-render-share-dialog'
import { requestNeedsReviewAck } from '../components/clips/needs-review-share-warning'

const createRenderShareLink = vi.fn(async () => ({ shareUrl: 'https://example.test/share/abc' }))
const revokeRenderShareLink = vi.fn(async () => undefined)

vi.mock('../lib/clips-api', () => ({
  createRenderShareLink: (...args: unknown[]) => createRenderShareLink(...args),
  revokeRenderShareLink: (...args: unknown[]) => revokeRenderShareLink(...args),
}))

// The production file still imports @/lib/clips-api; alias must be mocked too.
vi.mock('@/lib/clips-api', () => ({
  createRenderShareLink: (...args: unknown[]) => createRenderShareLink(...args),
  revokeRenderShareLink: (...args: unknown[]) => revokeRenderShareLink(...args),
}))

const flagged = {
  needsReview: true,
  needsReviewReasons: ['Leftover filler around the open'],
}

describe('needsReview share warning', () => {
  afterEach(() => {
    cleanup()
    createRenderShareLink.mockClear()
    revokeRenderShareLink.mockClear()
  })

  it('creates a share link immediately when the field is absent', async () => {
    render(<ExportRenderShareDialog renderId="rnd_1" open onOpenChange={() => undefined} />)
    fireEvent.click(screen.getByTestId('export-share-create'))
    await waitFor(() => expect(createRenderShareLink).toHaveBeenCalledTimes(1))
    expect(screen.queryByTestId('needs-review-share-warning')).toBeNull()
  })

  it('shows a confirm with reasons and does not create a link on cancel', async () => {
    render(
      <ExportRenderShareDialog renderId="rnd_2" open onOpenChange={() => undefined} aiMeta={flagged} />,
    )
    fireEvent.click(screen.getByTestId('export-share-create'))
    const warning = await screen.findByTestId('needs-review-share-warning')
    expect(warning.textContent).toContain('Leftover filler around the open')
    expect(createRenderShareLink).not.toHaveBeenCalled()
    fireEvent.click(screen.getByTestId('needs-review-share-cancel'))
    await waitFor(() => expect(screen.queryByTestId('needs-review-share-warning')).toBeNull())
    expect(createRenderShareLink).not.toHaveBeenCalled()
  })

  it('creates the link only after the user confirms', async () => {
    render(
      <ExportRenderShareDialog renderId="rnd_3" open onOpenChange={() => undefined} aiMeta={flagged} />,
    )
    fireEvent.click(screen.getByTestId('export-share-create'))
    await screen.findByTestId('needs-review-share-warning')
    fireEvent.click(screen.getByTestId('needs-review-share-confirm'))
    await waitFor(() => expect(createRenderShareLink).toHaveBeenCalledTimes(1))
  })

  it('requestNeedsReviewAck runs immediately when the clip is clean', () => {
    const action = vi.fn()
    const openWarning = vi.fn()
    requestNeedsReviewAck({ needsReview: false }, openWarning, action)
    expect(action).toHaveBeenCalledTimes(1)
    expect(openWarning).not.toHaveBeenCalled()
    requestNeedsReviewAck({ needsReview: true }, openWarning, action)
    expect(openWarning).toHaveBeenCalledTimes(1)
    expect(action).toHaveBeenCalledTimes(1)
  })
})
