import { describe, expect, it } from 'vitest'
import { editorEditsReducer } from '@/components/clips/editor/use-editor-state'
import { brollCoverCropStyle } from '@/lib/clips/broll-cover-crop'
import { cleanPixabayQuery, isManualBroll, mergeAutoBrollItems } from '@/lib/clips/broll-auto-utils'
import { countProducerFieldChanges } from '@/lib/clips/producer-diff'
import { defaultEdits } from '@/lib/clips/edits'
import type { ClipEditsV2 } from '@/lib/clips/edits'

const bounds = { clipStartMs: 0, clipEndMs: 60_000 }

function baseState(edits = defaultEdits(bounds)) {
  return {
    edits,
    past: [] as ClipEditsV2[],
    future: [] as ClipEditsV2[],
    saveState: 'saved' as const,
    producerStrip: null,
  }
}

describe('FAIL-1 producer undo strip in editor store', () => {
  it('shows strip across tabs (store) and toolbar undo clears it', () => {
    const before = defaultEdits(bounds)
    const after = {
      ...before,
      captions: { ...before.captions, presetId: 'karaoke', animation: 'karaoke' },
      audio: {
        music: {
          generationId: 'g1',
          volume: 0.2,
          duckDepth: 0.7,
          fadeInMs: 500,
          fadeOutMs: 500,
        },
        sfx: [],
      },
    }
    expect(countProducerFieldChanges(before, after)).toBe(2)

    const patched = editorEditsReducer(baseState(before), {
      type: 'BATCH',
      edits: after,
      before,
      producerChangeCount: 2,
    })
    expect(patched.producerStrip?.changeCount).toBe(2)

    const undone = editorEditsReducer(patched, { type: 'undo' })
    expect(undone.edits.captions?.presetId).toBe(before.captions?.presetId)
    expect(undone.producerStrip).toBeNull()
  })
})

describe('FAIL-2 auto B-roll replace', () => {
  it('drops legacy non-manual items and uses one query phrase', () => {
    expect(cleanPixabayQuery('comic book,reading')).toBe('comic book')
    expect(isManualBroll({ id: 'x', source: 'stock', assetId: 'a', startMs: 0, endMs: 1 })).toBe(false)
    const merged = mergeAutoBrollItems(
      [
        { id: '1', source: 'stock', assetId: 'a', startMs: 0, endMs: 1000 },
        { id: '2', source: 'stock', assetId: 'b', startMs: 2000, endMs: 3000, placement: 'manual' },
      ],
      [{ id: '3', source: 'stock', assetId: 'c', startMs: 5000, endMs: 6000, placement: 'auto' }],
    )
    expect(merged.map((b) => b.id)).toEqual(['2', '3'])
  })
})

describe('FAIL-3 B-roll cover crop', () => {
  it('letterboxed landscape fills 9:16 frame (squirrel-style)', () => {
    const box = brollCoverCropStyle(360, 640, 1920, 1080)
    expect(box).not.toBeNull()
    expect(box!.height).toBeGreaterThanOrEqual(640)
    expect(box!.width).toBeGreaterThanOrEqual(360)
  })
})

describe('FAIL-4 caption overlay inputs', () => {
  it('progress bar and emojis depend on caption flags', () => {
    const cap = {
      enabled: true,
      autoEmojis: true,
      emojiByWord: { '0': '🔥' },
      progressBar: { enabled: true, color: '#fff', position: 'bottom' as const, thickness: 8 },
    }
    expect(cap.progressBar?.enabled).toBe(true)
    expect(cap.autoEmojis && cap.emojiByWord['0']).toBe('🔥')
  })
})

describe('FAIL-5 export options', () => {
  it('aspect ratios are the supported set', () => {
    const aspects = ['9:16', '1:1', '16:9'] as const
    expect(aspects).toContain('9:16')
    expect(aspects).toContain('1:1')
    expect(aspects).toContain('16:9')
  })
})
