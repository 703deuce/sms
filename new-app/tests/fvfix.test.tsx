// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { formatMediaDuration } from '@/lib/clips/full-video'
import { formatMediaDuration as formatMediaDurationE5b } from '@/lib/clips/media-transcribe-cost'
import { TimelineWaveform, waveformEnvelope } from '@/components/clips/editor/timeline/timeline-waveform'
import { TimelineFilmstrip } from '@/components/clips/editor/timeline/timeline-filmstrip'
import type { FrameExtractor } from '@/components/clips/editor/timeline/use-filmstrip-frames'

const push = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
  useSearchParams: () => new URLSearchParams('intent=full'),
}))
const clipsFetch = vi.fn((..._a: unknown[]) => Promise.resolve({ id: 'proj_new' }))
vi.mock('@/lib/clips-api', () => ({
  clipsFetch: (...a: unknown[]) => clipsFetch(...a),
  createProject: vi.fn(),
  createProjectFromLink: vi.fn(),
  estimateCredits: vi.fn(() => Promise.resolve({ credits: 12 })),
}))
vi.mock('@/lib/clips/upload', () => ({
  uploadClipFile: vi.fn(() => Promise.resolve()),
  cancelClipUpload: vi.fn(),
  fetchUploadLimits: vi.fn(() => Promise.resolve({ maxLabel: '20 GB', effectiveMaxLabel: '20 GB', maxBytes: 1 })),
  rejectFileIfOverUploadLimit: vi.fn(() => null),
}))
vi.mock('@/lib/billing/entitlements', () => ({ featuresAllUnlocked: () => false, costOf: () => 1 }))
vi.mock('@/lib/features/t2v', () => ({ isT2vFeatureEnabled: () => true }))
vi.mock('@/components/streamer/streamer-import-panel', () => ({ StreamerImportPanel: () => null }))

import { NewProjectWorkspace } from '@/components/clips/new-project-workspace'
import { FindClipsInVideoButton } from '@/components/clips/editor/find-clips-in-video-button'

afterEach(() => cleanup())

describe('FVfix duration labels', () => {
  it('floors like the editor clock (715.74 s → 11:55)', () => {
    expect(formatMediaDuration(715_740)).toBe('11:55')
    expect(formatMediaDurationE5b(715_740)).toBe('11:55')
    expect(formatMediaDuration(3_723_900)).toBe('1:02:03')
  })
})

describe('FVfix waveform', () => {
  const peaks = { peaks: Array.from({ length: 715 * 20 }, (_, i) => (i % 20) / 20), peaksPerSec: 20, durationMs: 715_000 }
  it('interpolates when zoomed past the peak rate (no flat bars)', () => {
    const v = waveformEnvelope(peaks, 1000, 2000, 200) // 200 columns over 20 peaks
    const distinct = new Set(v.map((x) => x.toFixed(4)))
    expect(distinct.size).toBeGreaterThan(100)
  })
  it('draws only the visible window of a very wide item, to the end of the media', () => {
    const w = 715 * 32 // 12-min item at 20 % zoom ≈ 22 880 px
    const { getByTestId, rerender } = render(
      <TimelineWaveform peaks={peaks} mediaFromMs={0} mediaToMs={715_000} widthPx={w} visLeftPx={15_000} visRightPx={18_000} />,
    )
    let svg = getByTestId('timeline-waveform')
    expect(svg.getAttribute('data-from-px')).toBe('15000')
    expect(svg.getAttribute('data-to-px')).toBe('18000')
    rerender(<TimelineWaveform peaks={peaks} mediaFromMs={0} mediaToMs={715_000} widthPx={w} visLeftPx={w - 1500} visRightPx={w + 3000} />)
    svg = getByTestId('timeline-waveform')
    expect(svg.getAttribute('data-to-px')).toBe(String(w)) // the last minute is drawn
    // without a window it still never draws one huge strip
    rerender(<TimelineWaveform peaks={peaks} mediaFromMs={0} mediaToMs={715_000} widthPx={w} />)
    expect(Number(getByTestId('timeline-waveform').getAttribute('data-to-px'))).toBeLessThanOrEqual(6000)
  })
})

describe('FVfix filmstrip fallback', () => {
  it('unreadable frames (CORS) → the clip cover repeated, not an empty strip', () => {
    const failed = { failed: true, aspect: null, get: () => null, want: vi.fn() } as unknown as FrameExtractor
    const { getByTestId, getAllByTestId } = render(
      <TimelineFilmstrip fromMs={0} toMs={30_000} widthPx={600} heightPx={36} pxPerMs={0.02} frames={failed} stillUrl="https://cdn/cover.jpg" />,
    )
    expect(getByTestId('timeline-filmstrip').getAttribute('data-source')).toBe('still')
    const tiles = getAllByTestId('timeline-filmstrip-tile')
    expect(tiles.length).toBeGreaterThan(5)
    for (const t of tiles) expect((t as HTMLElement).style.backgroundImage).toContain('cover.jpg')
  })
  it('while frames load, tiles show the cover', () => {
    const loading = { failed: false, aspect: null, get: () => null, want: vi.fn() } as unknown as FrameExtractor
    const { getAllByTestId } = render(
      <TimelineFilmstrip fromMs={0} toMs={30_000} widthPx={600} heightPx={36} pxPerMs={0.02} frames={loading} stillUrl="https://cdn/cover.jpg" />,
    )
    expect((getAllByTestId('timeline-filmstrip-tile')[0] as HTMLElement).style.backgroundImage).toContain('cover.jpg')
    expect(loading.want).toHaveBeenCalled()
  })
})

describe('FVfix New project page', () => {
  it('shows the source row once (with Edit a full video selected)', () => {
    render(<NewProjectWorkspace />)
    expect(screen.getByText('Edit a full video')).toBeTruthy()
    expect(screen.getAllByText('Upload file')).toHaveLength(1)
    expect(screen.getAllByText('Paste link')).toHaveLength(1)
    expect(screen.getAllByText('Streamer')).toHaveLength(1)
    expect(screen.getAllByText('AI Video')).toHaveLength(1)
    fireEvent.click(screen.getByTestId('new-project-source-link'))
    expect((screen.getByTestId('new-project-source-link').querySelector('input') as HTMLInputElement).checked).toBe(true)
  })
})

describe('FVfix Find clips dialog', () => {
  it('uses the in-page dialog (credits only), not window.confirm', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm')
    render(<FindClipsInVideoButton projectId="proj_1" durationMs={715_740} settings={{}} />)
    await act(async () => {
      fireEvent.click(screen.getByTestId('editor-find-clips-in-video'))
    })
    expect(confirmSpy).not.toHaveBeenCalled()
    const text = screen.getByTestId('find-clips-dialog-text').textContent
    expect(text).toBe('Find clips in this video? Est. 12 credits. Your full-video edit stays as it is.')
    expect(text).not.toContain('$')
    fireEvent.click(screen.getByTestId('find-clips-cancel'))
    expect(screen.queryByTestId('find-clips-dialog')).toBeNull()
    expect(clipsFetch).not.toHaveBeenCalled()
    await act(async () => {
      fireEvent.click(screen.getByTestId('editor-find-clips-in-video'))
    })
    await act(async () => {
      fireEvent.click(screen.getByTestId('find-clips-start'))
    })
    expect(clipsFetch).toHaveBeenCalledWith('/api/clips/projects/proj_1/find-clips', expect.objectContaining({ method: 'POST' }))
    expect(push).toHaveBeenCalledWith('/app/clips/proj_new')
  })
})
