import { defaultEdits, type ClipEditsV2 } from '@/lib/clips/edits'
import type { BrollItem } from '@/lib/clips/broll'
import type { TextItem } from '@/lib/clips/editor/text-items'
import type { ClipMediaSource, SourceSegment } from '@/lib/clips/editor/sources'

export type AdTimelineScene = {
  id: string
  index: number
  role: 'hook' | 'problem' | 'solution' | 'cta' | 'other'
  source: 'generated' | 'stock'
  status: string
  startMs: number
  endMs: number
  onScreenText?: string
  stockAssetId?: string | null
  sourceInMs?: number | null
  trimInMs?: number | null
  uploadId?: string
}

const sceneTextStyle = (aspect: '9:16' | '16:9' | '1:1'): TextItem['style'] => ({
  font: 'Poppins',
  size: aspect === '9:16' ? 84 : 76,
  color: '#FFFFFF',
  align: 'center',
  case: 'none',
  stroke: { color: '#000000', width: 7 },
  shadow: { color: '#000000', opacity: 75, dist: 5 },
  box: { color: '#000000', opacity: 42, pad: 16 },
})

function sceneTextItem(scene: AdTimelineScene, endMs: number, aspect: '9:16' | '16:9' | '1:1'): TextItem | null {
  const text = scene.onScreenText?.trim()
  if (!text || endMs - scene.startMs < 300) return null
  return {
    id: `ad_scene_text_${scene.index}`,
    text,
    startMs: scene.startMs,
    endMs,
    x: 50,
    y: aspect === '9:16' ? 20 : 16,
    style: sceneTextStyle(aspect),
    presetId: 'shadow_soft',
    anim: {
      in: { type: 'fade', unit: 'block', durMs: 250 },
      out: { type: 'fade', unit: 'block', durMs: 220 },
    },
  }
}

export function buildAdTimelineEdits(input: {
  durationMs: number
  aspect: '9:16' | '16:9' | '1:1'
  productName: string
  scenes: AdTimelineScene[]
  productPhotos: Array<{ uploadId: string; label: string }>
  voice?: { uploadId: string; durationMs: number; wordsAvailable: boolean }
  music?: { uploadId: string }
  logo?: { storageKey: string; startMs: number; endMs: number }
}): ClipEditsV2 {
  console.info('[ad-studio:b3] timeline_build_begin', {
    durationMs: input.durationMs,
    scenes: input.scenes.length,
    voiceover: Boolean(input.voice),
    captions: Boolean(input.voice?.wordsAvailable),
    music: Boolean(input.music),
    logo: Boolean(input.logo),
  })
  const base = defaultEdits({
    clipStartMs: 0,
    clipEndMs: input.durationMs,
    trimMinMs: 0,
    trimMaxMs: input.durationMs,
  })
  const sources: ClipMediaSource[] = input.productPhotos.map(p => ({
    id: p.uploadId, ref: 'upload', refId: p.uploadId, label: p.label, mediaType: 'image',
  }))
  const sourceSegments: SourceSegment[] = []
  const broll: BrollItem[] = []
  const textItems: TextItem[] = []

  for (const scene of [...input.scenes].sort((a,b) => a.index - b.index)) {
    if (scene.status === 'skipped' || scene.startMs >= input.durationMs) {
      console.info('[ad-studio:b3] timeline_scene_skipped', { index: scene.index, status: scene.status })
      continue
    }
    const endMs = Math.min(scene.endMs, input.durationMs)
    if (endMs <= scene.startMs) throw new Error('Invalid Ad Studio scene bounds')
    if (scene.source === 'stock') {
      if (!scene.stockAssetId) throw new Error('Ad Studio stock source missing')
      broll.push({
        id: `ads_${scene.index}`, source: 'stock', assetId: scene.stockAssetId,
        startMs: scene.startMs, endMs, inMs: scene.sourceInMs ?? 0, placement: 'manual',
      })
    } else {
      if (!scene.uploadId) throw new Error('Ad Studio generated source missing')
      sources.push({
        id: scene.uploadId, ref: 'upload', refId: scene.uploadId, mediaType: 'video',
        durationMs: (endMs - scene.startMs) + (scene.trimInMs ?? 0),
      })
      sourceSegments.push({
        id: `adg_${scene.index}`, sourceId: scene.uploadId,
        startMs: scene.startMs, endMs, inMs: scene.trimInMs ?? 0,
        audio: 'main', fit: 'cover',
      })
    }

    const overlay = sceneTextItem(scene, endMs, input.aspect)
    if (overlay) textItems.push(overlay)
    if (scene.role === 'cta') {
      textItems.push({
        id: `ad_cta_product_${scene.index}`,
        text: input.productName,
        startMs: scene.startMs,
        endMs,
        x: 50,
        y: input.aspect === '9:16' ? 37 : 34,
        style: {
          font: 'Montserrat', size: input.aspect === '9:16' ? 108 : 96, color: '#FFFFFF',
          align: 'center', case: 'upper', stroke: { color: '#000000', width: 9 },
          shadow: { color: '#000000', opacity: 80, dist: 6 },
        },
        presetId: 'basic',
        anim: { in: { type: 'pop', unit: 'block', durMs: 320 }, out: { type: 'fade', unit: 'block', durMs: 240 } },
      })
      console.info('[ad-studio:b3] timeline_cta_overlay', { index: scene.index, startMs: scene.startMs, endMs })
    }
    console.info('[ad-studio:b3] timeline_scene_attached', {
      index: scene.index, source: scene.source, startMs: scene.startMs, endMs,
      inMs: scene.source === 'stock' ? scene.sourceInMs : scene.trimInMs,
      hasText: Boolean(overlay),
    })
  }

  const result: ClipEditsV2 = {
    ...base,
    aspectRatio: input.aspect,
    layout: { mode: 'full_frame', shotOverrides: [] },
    captions: input.voice?.wordsAvailable
      ? { ...base.captions, enabled: true }
      : { enabled: false },
    sources,
    sourceSegments,
    broll,
    ...(textItems.length ? { textItems } : {}),
    ...(input.logo ? {
      brand: {
        logoKey: input.logo.storageKey,
        logoPosition: 'TR',
        logoSizePct: 12,
        logoOpacity: 0.95,
        logoStartMs: input.logo.startMs,
        logoEndMs: input.logo.endMs,
      },
    } : {}),
    audio: {
      music: input.music ? {
        generationId: input.music.uploadId,
        uploadId: input.music.uploadId,
        volume: 0.12,
        duckDepth: 0.72,
        fadeInMs: 400,
        fadeOutMs: 800,
        startMs: 0,
        endMs: input.durationMs,
        loop: true,
      } : null,
      sfx: input.voice ? [{
        generationId: input.voice.uploadId,
        uploadId: input.voice.uploadId,
        atMs: 0,
        durMs: Math.min(input.durationMs, input.voice.durationMs),
        volume: 1,
        kind: 'audio',
      }] : [],
    },
  }
  console.info('[ad-studio:b3] timeline_build_complete', {
    sources: sources.length,
    broll: broll.length,
    videoSegments: sourceSegments.length,
    voiceover: Boolean(input.voice),
    captions: Boolean(input.voice?.wordsAvailable),
    textItems: textItems.length,
    music: Boolean(input.music),
    logo: Boolean(input.logo),
  })
  return result
}
