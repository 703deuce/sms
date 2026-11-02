// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'

const fetchProjectHighlights = vi.fn()

vi.mock('@/lib/clips/editor/make-clip-from-pick', () => ({
  fetchProjectHighlights: (...args: unknown[]) => fetchProjectHighlights(...args),
  makeClipFromPick: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}))

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

import { useFullVideoHighlights } from '@/components/clips/editor/use-full-video-highlights'

describe('useFullVideoHighlights', () => {
  const store = new Map<string, string>()
  beforeEach(() => {
    vi.clearAllMocks()
    store.clear()
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => {
        store.set(k, v)
      },
      removeItem: (k: string) => {
        store.delete(k)
      },
      clear: () => store.clear(),
    })
  })

  it('auto-enables highlights lane when find picks load (no prior toggle)', async () => {
    fetchProjectHighlights.mockResolvedValue({
      source: 'find',
      status: 'DONE',
      progress: 100,
      picks: [
          {
            clipId: 'fp_job_0',
            title: 'Moment',
            startMs: 3600,
            endMs: 32000,
            score: 77,
            reasonTag: 'visual',
            why: null,
            origin: 'find',
            findJobId: 'job_1',
          },
        ],
    })

    const { result, unmount } = renderHook(() => useFullVideoHighlights('proj_fv', true, []))

    await waitFor(() => {
      expect(result.current.hasPicks).toBe(true)
      expect(result.current.highlightsOn).toBe(true)
      expect(result.current.source).toBe('find')
    })

    expect(store.get('transovo.highlights.proj_fv')).toBe('1')
    unmount()
  })

  it('shows finding state while FIND_CLIPS job is RUNNING', async () => {
    fetchProjectHighlights.mockResolvedValue({
      source: 'find',
      status: 'RUNNING',
      progress: 55,
      picks: [],
    })

    const { result, unmount } = renderHook(() => useFullVideoHighlights('proj_fv', true, []))

    await waitFor(() => {
      expect(result.current.isJobRunning).toBe(true)
      expect(result.current.showHighlightsList).toBe(true)
      expect(result.current.progress).toBe(55)
    })

    unmount()
  })
})
