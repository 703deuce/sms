// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { ClipCard } from '@/components/clips/clip-card'

const patch = vi.fn(async (..._args: unknown[]) => ({ data: { hidden: true } }))
const hidden = vi.fn()
const toast = vi.hoisted(() => ({
  loading: vi.fn(() => 'feedback-toast'),
  success: vi.fn(),
  error: vi.fn(),
  message: vi.fn(),
}))
vi.mock('sonner', () => ({ toast }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), prefetch: vi.fn() }) }))
vi.mock('@/lib/clips-api', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/lib/clips-api')>()
  return { ...original, clipsFetch: (...args: unknown[]) => patch(...args) }
})

afterEach(() => { cleanup(); vi.clearAllMocks() })

describe('LG08 existing clip-card thumbs-down feedback', () => {
  it('acknowledges a saved hide, without requesting regeneration or changing scores', async () => {
    const clip = {
      id: 'clip_feedback',
      title: 'Moment',
      score: 92,
      durationMs: 12000,
      startMs: 0,
      endMs: 12000,
      posterUrl: null,
      previewUrl: null,
      scores: { hook: 'A' },
    }
    render(<ClipCard clip={clip} projectId="proj_fixture" onHidden={hidden} />)
    const more = screen.getByTestId('clip-card-more')
    fireEvent.click(more)
    fireEvent.click(await screen.findByText('Not for me'))
    await waitFor(() => expect(hidden).toHaveBeenCalledWith('clip_feedback'))
    expect(patch).toHaveBeenCalledWith('/api/clips/clips/clip_feedback', {
      method: 'PATCH', body: JSON.stringify({ hidden: true, disliked: true }),
    })
    expect(toast.success).toHaveBeenCalledWith('Feedback saved — clip hidden', { id: 'feedback-toast' })
    expect(clip.score).toBe(92)
    expect(patch).toHaveBeenCalledTimes(1)
  })
})
