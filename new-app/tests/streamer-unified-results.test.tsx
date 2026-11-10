// @vitest-environment happy-dom
// @ts-expect-error root tsc does not resolve the new-app vitest install
import { afterEach, describe, expect, it, vi } from 'vitest'
// @ts-expect-error root tsc does not resolve the new-app testing-library install
import { cleanup, render, screen } from '@testing-library/react'
import { adaptStreamerClipsForUnifiedGrid, streamerUnifiedGridStatus } from '../lib/clips/adapt-streamer-unified-clips'
import { StreamerUnifiedResults } from '../components/streamer/streamer-unified-results'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
}))

const STREAM_CLIPS = [
  {
    id: 'clip_stream_story',
    projectId: 'proj_vod_1',
    title: 'Pulled stream hook',
    score: 92,
    startMs: 0,
    endMs: 40_000,
    type: 'story',
    previewUrl: 'https://example.com/previews/stream-hook.mp4',
    posterUrl: 'https://example.com/posters/stream-hook.jpg',
    needsReview: true,
    needsReviewReasons: ['unfinished_ending'],
  },
  {
    id: 'clip_stream_cont',
    projectId: 'proj_vod_1',
    title: 'Unbroken raid call',
    score: 81,
    startMs: 120_000,
    endMs: 142_000,
    type: 'continuous',
    previewUrl: 'https://example.com/previews/stream-cont.mp4',
    posterUrl: 'https://example.com/posters/stream-cont.jpg',
  },
]

describe('streamer unified results grid', () => {
  afterEach(() => cleanup())

  it('adapts stream list-project-clips rows from a pulled VOD onto the unified grid props', () => {
    const rows = adaptStreamerClipsForUnifiedGrid(STREAM_CLIPS)
    expect(rows).toHaveLength(2)
    expect(rows.map((c) => c.resultKind)).toEqual(['story', 'continuous'])
    expect(rows[0]?.needsReview).toBe(true)
    expect(rows[0]?.projectId).toBe('proj_vod_1')
    expect(rows[1]?.durationMs).toBe(22_000)
  })

  it('maps processing / failed / ready statuses without inventing clips', () => {
    expect(streamerUnifiedGridStatus({ clipCount: 0, processing: true, failed: false })).toBe('loading')
    expect(streamerUnifiedGridStatus({ clipCount: 0, processing: false, failed: true })).toBe('error')
    expect(streamerUnifiedGridStatus({ clipCount: 0, processing: false, failed: false })).toBe('empty')
    expect(streamerUnifiedGridStatus({ clipCount: 2, processing: true, failed: false })).toBe('ready')
  })

  it('renders the same unified grid (score, type badge, needsReview, edit) for stream clips', () => {
    render(
      <StreamerUnifiedResults
        clips={STREAM_CLIPS}
        fallbackProjectId="proj_vod_1"
      />,
    )
    expect(screen.getByTestId('streamer-unified-results')).toBeTruthy()
    expect(screen.getByText('Pulled stream hook')).toBeTruthy()
    expect(screen.getByText('Unbroken raid call')).toBeTruthy()
    expect(screen.getAllByTestId('unified-clip-type-badge').map((el: HTMLElement) => el.getAttribute('data-kind')).sort()).toEqual(
      ['continuous', 'story'],
    )
    expect(screen.getAllByTestId('clip-needs-review-badge').length).toBeGreaterThan(0)
    const edit = screen.getAllByRole('link').find((el) => el.getAttribute('href')?.includes('/studio/clip_stream_story'))
    expect(edit).toBeTruthy()
  })

  it('shows designed progress when a pulled stream is still processing and has no clips yet', () => {
    render(
      <StreamerUnifiedResults
        clips={[]}
        fallbackProjectId="proj_vod_1"
        processing
        etaSec={90}
      />,
    )
    expect(screen.getByTestId('unified-clip-progress')).toBeTruthy()
  })
})
