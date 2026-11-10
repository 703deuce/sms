// @vitest-environment happy-dom
// @ts-expect-error root tsc does not resolve the new-app vitest install
import { afterEach, describe, expect, it, vi } from 'vitest'
// @ts-expect-error root tsc does not resolve @testing-library/react
import { cleanup, render, screen } from '@testing-library/react'
import { ClipCard } from '../components/clips/clip-card'
import { ClipGrid } from '../components/clips/clip-grid'
import { NeedsReviewBadge } from '../components/clips/needs-review-badge'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), prefetch: vi.fn() }),
}))

const flaggedMeta = {
  needsReview: true,
  needsReviewReasons: ['Hook is weaker than the later payoff', 'Audio dips at 0:12'],
}

const baseClip = {
  id: 'clip_nr',
  title: 'Payoff moment',
  score: 80,
  scores: { hook: 'A', flow: 'B', value: 'A' },
  durationMs: 12_000,
  startMs: 10_000,
  endMs: 22_000,
  previewUrl: null,
  posterUrl: null,
}

describe('NeedsReviewBadge', () => {
  afterEach(() => cleanup())

  it('renders nothing when the field is absent or not true', () => {
    const { rerender } = render(<NeedsReviewBadge />)
    expect(screen.queryByTestId('clip-needs-review-badge')).toBeNull()
    rerender(<NeedsReviewBadge aiMeta={{}} />)
    expect(screen.queryByTestId('clip-needs-review-badge')).toBeNull()
    rerender(<NeedsReviewBadge aiMeta={{ needsReview: false, needsReviewReasons: ['x'] }} />)
    expect(screen.queryByTestId('clip-needs-review-badge')).toBeNull()
  })

  it('renders a keyboard-reachable badge whose accessible name includes the reasons', () => {
    render(<NeedsReviewBadge aiMeta={flaggedMeta} />)
    const badge = screen.getByTestId('clip-needs-review-badge')
    expect(badge.textContent).toMatch(/Needs review/)
    expect(badge.getAttribute('aria-label')).toContain('Hook is weaker than the later payoff')
    expect(badge.getAttribute('aria-label')).toContain('Audio dips at 0:12')
    expect(badge.tagName).toBe('BUTTON')
    expect((badge as HTMLButtonElement).type).toBe('button')
  })

  it('shows the badge and reasons on ClipCard and ClipGrid', () => {
    const clip = { ...baseClip, aiMeta: flaggedMeta }
    const { unmount } = render(<ClipCard projectId="proj_nr" clip={clip} />)
    expect(screen.getByTestId('clip-needs-review-badge')).toBeTruthy()
    expect(screen.getByTestId('clip-needs-review-reason-list').textContent).toContain('Hook is weaker')
    unmount()
    render(<ClipGrid projectId="proj_nr" clips={[clip]} />)
    expect(screen.getByTestId('clip-needs-review-badge')).toBeTruthy()
    expect(screen.getByTestId('clip-needs-review-reason-list').textContent).toContain('Audio dips at 0:12')
  })
})
