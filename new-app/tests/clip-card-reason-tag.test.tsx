// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { ClipCard } from '@/components/clips/clip-card'
import { clipScoreTooltipLines } from '@/lib/clips/clip-results-chips'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), prefetch: vi.fn() }),
}))

describe('clip-card reason tag', () => {
  afterEach(() => cleanup())

  it('renders tag chip and tooltip lines', () => {
    const clip = {
          id: 'clip_x',
          title: 'Hot take',
          score: 82,
          scores: { hook: 'A', flow: 'B', value: 'A' },
          durationMs: 12_000,
          startMs: 10_000,
          endMs: 22_000,
          previewUrl: null,
          posterUrl: null,
          reason: 'Internal (s12) may mark payoff',
          aiMeta: {
            reasonTag: 'both',
            videoWhy: 'Clear punchline after setup',
            hook: 'Setup then payoff',
          },
        }
    const lines = clipScoreTooltipLines(clip)
    expect(lines.some((l) => l.includes('Clear punchline'))).toBe(true)
    expect(lines.some((l) => l.includes('Hook:'))).toBe(true)
    render(<ClipCard projectId="proj_x" clip={clip} />)
    expect(screen.getByTestId('clip-reason-tag').textContent).toMatch(/Both/)
    expect(screen.queryByText(/Internal \(s12\)/)).toBeNull()
  })
})
