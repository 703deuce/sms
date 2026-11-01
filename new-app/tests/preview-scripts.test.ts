import { describe, expect, it } from 'vitest'
import { defaultEdits, normalizeEdits } from '@/lib/clips/edits'
import { newTextItem } from '@/lib/clips/editor/text-items'
import { buildPreviewScripts } from '@/lib/clips/render-plan/preview-scripts'

const bounds = { clipStartMs: 0, clipEndMs: 20_000, trimMinMs: 0, trimMaxMs: 40_000 }

describe('CV-17c preview scripts (text fx partition)', () => {
  it('splits mask/blend text items into fx[] and omits them from the main text script', () => {
    const plain = newTextItem('plain', 0, 20_000, 'basic', 'Plain')
    const fx = newTextItem('fx1', 0, 20_000, 'basic', 'Fx')
    const edits = normalizeEdits(
      {
        ...defaultEdits(bounds),
        textItems: [plain, fx],
        layerFx: [{ target: 'text:fx1', mask: { shape: 'rect', x: 50, y: 50, w: 60, h: 40, rot: 0, feather: 10 }, blend: 'multiply' }],
      },
      bounds,
    )
    const scripts = buildPreviewScripts({
      edits: edits as unknown as Record<string, unknown>,
      words: [],
      playW: 1080,
      playH: 1920,
      durationMs: 20_000,
    })
    expect(scripts.text).toContain('Plain')
    expect(scripts.text).not.toContain('Fx')
    expect(scripts.fx).toHaveLength(1)
    expect(scripts.fx![0]).toMatchObject({ id: 'fx1', key: 'fx:fx1' })
    expect(scripts.fx![0]!.ass).toContain('Fx')
  })

  it('audition lookEdits: layerFx only in live preview edits splits fx[] off main text', () => {
    const item = newTextItem('t1', 0, 20_000, 'basic', 'Audition')
    const committed = normalizeEdits({ ...defaultEdits(bounds), textItems: [item] }, bounds)
    expect(committed.layerFx).toBeFalsy()
    const lookEdits = normalizeEdits(
      {
        ...committed,
        layerFx: [{ target: 'text:t1', mask: { shape: 'ellipse', x: 50, y: 50, w: 15, h: 10, rot: 0, feather: 0 } }],
      },
      bounds,
    )
    const scripts = buildPreviewScripts({
      edits: lookEdits as unknown as Record<string, unknown>,
      words: [],
      playW: 1080,
      playH: 1920,
      durationMs: 20_000,
    })
    expect(scripts.fx).toHaveLength(1)
    expect(scripts.fx![0]!.id).toBe('t1')
    expect(scripts.fx![0]!.ass).toContain('Audition')
    expect(scripts.text).toBeNull()
  })

  it('keeps a single plain text script when no fx rows', () => {
    const edits = normalizeEdits({ ...defaultEdits(bounds), textItems: [newTextItem('a', 0, 20_000)] }, bounds)
    const scripts = buildPreviewScripts({
      edits: edits as unknown as Record<string, unknown>,
      words: [],
      playW: 720,
      playH: 1280,
      durationMs: 10_000,
    })
    expect(scripts.fx).toBeUndefined()
    expect(scripts.text).toContain('Your text')
  })
})
