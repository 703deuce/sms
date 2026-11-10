import { defaultEdits, type ClipEditsV2 } from '@/lib/clips/edits'
import type { BrollItem } from '@/lib/clips/broll'
import type { ClipMediaSource, SourceSegment } from '@/lib/clips/editor/sources'

export type AdTimelineScene = {
  id: string
  index: number
  source: 'generated' | 'stock'
  status: string
  startMs: number
  endMs: number
  stockAssetId?: string | null
  sourceInMs?: number | null
  trimInMs?: number | null
  uploadId?: string
}

export function buildAdTimelineEdits(input: {
  durationMs: number
  aspect: '9:16' | '16:9' | '1:1'
  scenes: AdTimelineScene[]
  productPhotos: Array<{ uploadId: string; label: string }>
  voice?: { uploadId: string; durationMs: number }
}): ClipEditsV2 {
  console.info('[ad-studio:b3] timeline_build_begin', { durationMs: input.durationMs, scenes: input.scenes.length })
  const sources: ClipMediaSource[] = input.productPhotos.map(p => ({
    id: p.uploadId, ref: 'upload', refId: p.uploadId, label: p.label, mediaType: 'image',
  }))
  const sourceSegments: SourceSegment[] = []
  const broll: BrollItem[] = []
  for (const scene of [...input.scenes].sort((a,b) => a.index - b.index)) {
    if (scene.status === 'skipped') continue
    if (scene.endMs <= scene.startMs || scene.endMs > input.durationMs) throw new Error('Invalid Ad Studio scene bounds')
    if (scene.source === 'stock') {
      if (!scene.stockAssetId) throw new Error('Ad Studio stock source missing')
      broll.push({
        id: `ads_${scene.index}`, source: 'stock', assetId: scene.stockAssetId,
        startMs: scene.startMs, endMs: scene.endMs, inMs: scene.sourceInMs ?? 0, placement: 'manual',
      })
    } else {
      if (!scene.uploadId) throw new Error('Ad Studio generated source missing')
      sources.push({ id: scene.uploadId, ref: 'upload', refId: scene.uploadId, mediaType: 'video',
        durationMs: (scene.endMs - scene.startMs) + (scene.trimInMs ?? 0) })
      sourceSegments.push({
        id: `adg_${scene.index}`, sourceId: scene.uploadId,
        startMs: scene.startMs, endMs: scene.endMs, inMs: scene.trimInMs ?? 0,
        audio: 'main', fit: 'cover',
      })
    }
    console.info('[ad-studio:b3] timeline_scene_attached', { index: scene.index, source: scene.source,
      startMs: scene.startMs, endMs: scene.endMs, inMs: scene.source === 'stock' ? scene.sourceInMs : scene.trimInMs })
  }
  const result: ClipEditsV2 = {
    ...defaultEdits({ clipStartMs: 0, clipEndMs: input.durationMs, trimMinMs: 0, trimMaxMs: input.durationMs }),
    aspectRatio: input.aspect,
    layout: { mode: 'full_frame', shotOverrides: [] },
    captions: { enabled: false },
    sources, sourceSegments, broll,
    audio: { music: null, sfx: input.voice ? [{
      generationId: input.voice.uploadId, uploadId: input.voice.uploadId,
      atMs: 0, durMs: Math.min(input.durationMs, input.voice.durationMs), volume: 1, kind: 'audio',
    }] : [] },
  }
  console.info('[ad-studio:b3] timeline_build_complete', { sources: sources.length, broll: broll.length,
    videoSegments: sourceSegments.length, voiceover: Boolean(input.voice) })
  return result
}
