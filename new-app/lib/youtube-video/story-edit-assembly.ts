import type { ClipEditsV2 } from '@/lib/clips/edits'
import { normalizeInserts } from '@/lib/clips/editor/inserts'
import { normalizeMediaSources } from '@/lib/clips/editor/sources'
import type { YoutubeVideoCut } from '@/lib/youtube-video/types'

const MAX_INSERT_MS = 10 * 60_000
const MAX_INSERTS = 50

/** Preserve every approved source cut, including repeated portions of the
 * first upload, using the existing E5b video+audio append renderer. */
export function buildYoutubeStoryEditAssembly(
  base: ClipEditsV2,
  cuts: readonly YoutubeVideoCut[],
  uploads: readonly { id: string; label: string; durationMs: number | null }[],
): ClipEditsV2 {
  if (!cuts.length || cuts.length !== uploads.length) throw new Error('youtube_story_cut_source_mismatch')
  const first = cuts[0]!
  const sources = normalizeMediaSources(uploads.map((upload, i) => ({
    id: `yt_source_${i}`, ref: 'upload', refId: upload.id, mediaType: 'video',
    label: upload.label, ...(upload.durationMs ? { durationMs: upload.durationMs } : {}),
  })))
  if (!sources || sources.length !== cuts.length) throw new Error('youtube_story_invalid_media_sources')
  const rawInserts: Array<{
    id: string; sourceId: string; atSrcMs: number; append: true;
    inMs: number; durMs: number; audio: 'source'; fit: 'contain'
  }> = []
  cuts.slice(1).forEach((cut, i) => {
    if (!Number.isFinite(cut.startMs) || !Number.isFinite(cut.endMs) || cut.endMs <= cut.startMs) {
      throw new Error('youtube_story_invalid_segment_bounds')
    }
    for (let start = cut.startMs; start < cut.endMs;) {
      const end = Math.min(start + MAX_INSERT_MS, cut.endMs)
      rawInserts.push({
        id: `yt_insert_${rawInserts.length}`, sourceId: `yt_source_${i+1}`,
        atSrcMs: first.endMs, append: true, inMs: start, durMs: end - start,
        audio: 'source', fit: 'contain',
      })
      if (rawInserts.length > MAX_INSERTS) throw new Error('youtube_story_too_many_insert_segments')
      start = end
    }
  })
  const inserts = normalizeInserts(rawInserts, sources)
  if (rawInserts.length && inserts?.length !== rawInserts.length) {
    throw new Error('youtube_story_insert_normalization_mismatch')
  }
  for (let i = 0; i < rawInserts.length; i++) {
    if (inserts?.[i]?.inMs !== rawInserts[i]!.inMs || inserts[i]?.durMs !== rawInserts[i]!.durMs) {
      throw new Error('youtube_story_segment_clamped')
    }
  }
  return {
    ...base,
    trim: { in: first.startMs, out: first.endMs },
    cutRanges: [],
    aspectRatio: '16:9',
    layout: { ...base.layout, mode: 'full_frame' },
    captions: { ...base.captions, enabled: false },
    sources, ...(inserts ? { inserts } : {}),
  }
}
