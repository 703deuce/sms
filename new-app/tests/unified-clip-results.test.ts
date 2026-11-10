// @ts-expect-error root tsc does not resolve the new-app vitest install
import { describe, expect, it } from 'vitest'
import {
  MOCK_UNIFIED_CLIPS,
  UNIFIED_AUTO_AGENT_CLIP_MODE,
  adaptListProjectClip,
  adaptListProjectClips,
  filterSortUnifiedClips,
  inferUnifiedClipKind,
  unifiedClipCounts,
} from '../lib/clips/unified-clip-results'

describe('unified clip results adapter', () => {
  it('sends clip_unified_v1 per the posted contract', () => {
    expect(UNIFIED_AUTO_AGENT_CLIP_MODE).toBe('clip_unified_v1')
  })

  it('reads the forthcoming type field from the list payload', () => {
    const story = adaptListProjectClip({
      id: 'a',
      title: 'Hook',
      score: 90,
      startMs: 0,
      endMs: 20_000,
      type: 'story',
    })
    const continuous = adaptListProjectClip({
      id: 'b',
      title: 'Beat',
      score: 80,
      startMs: 20_000,
      endMs: 40_000,
      type: 'continuous',
    })
    expect(story?.resultKind).toBe('story')
    expect(continuous?.resultKind).toBe('continuous')
  })

  it('infers story vs continuous from agent metadata and titles when type is absent', () => {
    expect(inferUnifiedClipKind({ id: '1', aiMeta: { storyMode: 'clip_story_v1' } })).toBe('story')
    expect(inferUnifiedClipKind({ id: '2', aiMeta: { storyMode: 'clip_moment_v1' } })).toBe('continuous')
    expect(inferUnifiedClipKind({ id: '3', aiMeta: { clipAgentMode: 'moment' } })).toBe('continuous')
    expect(inferUnifiedClipKind({ id: '4', title: 'AI story clip · podcast' })).toBe('story')
    expect(inferUnifiedClipKind({ id: '5', title: 'AI moment clip · podcast' })).toBe('continuous')
    expect(inferUnifiedClipKind({ id: '6', edits: { sources: [{}, {}] } })).toBe('story')
  })

  it('leans Story when nothing identifies the clip', () => {
    expect(inferUnifiedClipKind({ id: 'x', title: 'Untitled' })).toBe('story')
  })

  it('drops malformed rows and wraps a { clips } payload', () => {
    const rows = adaptListProjectClips({
      clips: [{ id: 'ok', title: 'Ok', score: 10, startMs: 0, endMs: 1000, type: 'continuous' }, { title: 'no id' }],
    })
    expect(rows).toHaveLength(1)
    expect(rows[0]?.id).toBe('ok')
    expect(rows[0]?.durationMs).toBe(1000)
    expect(rows[0]?.resultKind).toBe('continuous')
  })

  it('filters by type and sorts by score, type, and duration', () => {
    const storyOnly = filterSortUnifiedClips(MOCK_UNIFIED_CLIPS, { type: 'story', sort: 'score' })
    expect(storyOnly.every((c) => c.resultKind === 'story')).toBe(true)
    expect(storyOnly.map((c) => c.id)).toEqual(['clip_story_hook', 'clip_story_arc'])

    const byType = filterSortUnifiedClips(MOCK_UNIFIED_CLIPS, { sort: 'type' })
    expect(byType.map((c) => c.resultKind)).toEqual(['story', 'story', 'continuous', 'continuous'])

    const byDuration = filterSortUnifiedClips(MOCK_UNIFIED_CLIPS, { sort: 'duration' })
    expect(byDuration[0]?.id).toBe('clip_story_arc')
    expect(byDuration[byDuration.length - 1]?.id).toBe('clip_continuous_insight')
  })

  it('counts story and continuous clips', () => {
    expect(unifiedClipCounts(MOCK_UNIFIED_CLIPS)).toEqual({ total: 4, story: 2, continuous: 2 })
  })

  it('maps the posted contract shape (clipId, durationSeconds, needsReview) from an uploaded-file run', () => {
    const clip = adaptListProjectClip({
      clipId: 'clip_from_upload',
      projectId: 'proj_upload',
      type: 'story',
      title: 'Uploaded hook',
      score: 91,
      durationSeconds: 42.5,
      startMs: 1000,
      endMs: 43_500,
      needsReview: true,
      needsReviewReasons: ['unfinished_ending'],
    })
    expect(clip?.id).toBe('clip_from_upload')
    expect(clip?.durationMs).toBe(42_500)
    expect(clip?.resultKind).toBe('story')
    expect(clip?.needsReview).toBe(true)
    expect(clip?.needsReviewReasons).toEqual(['unfinished_ending'])
  })

  it('does not re-dedupe overlapping clips; the backend list is already final', () => {
    const rows = adaptListProjectClips([
      { id: 'a', title: 'Story', type: 'story', score: 90, startMs: 0, endMs: 20_000 },
      { id: 'b', title: 'Overlap', type: 'continuous', score: 80, startMs: 1000, endMs: 18_000 },
    ])
    expect(rows).toHaveLength(2)
    expect(filterSortUnifiedClips(rows).map((c) => c.id)).toEqual(['a', 'b'])
  })
})
