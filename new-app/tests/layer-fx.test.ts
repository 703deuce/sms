import { describe, expect, it } from 'vitest'
import { defaultEdits, normalizeEdits } from '@/lib/clips/edits'
import { fxTargetOf, layerFxOf, normalizeLayerFx, setLayerFx } from '@/lib/clips/editor/layer-fx'

const bounds = { clipStartMs: 0, clipEndMs: 10_000, trimMinMs: 0, trimMaxMs: 20_000 }

describe('layerFx targets (CV-17a)', () => {
  it('accepts video, text:, adjust: and rejects bare text', () => {
    expect(fxTargetOf('video')).toBe('video')
    expect(fxTargetOf('text:abc')).toBe('text')
    expect(fxTargetOf('adjust:x')).toBe('adjust')
    expect(fxTargetOf('text')).toBeNull()
    expect(fxTargetOf('hook')).toBeNull()
  })

  it('strips disallowed fields per kind and caps text rows at 6', () => {
    const raw = [
      { target: 'video', blend: 'screen', reverse: true, mask: { shape: 'rect', x: 50, y: 50, w: 60, h: 40, rot: 0, feather: 0 }, key: { color: '#00ff00', sim: 40, blend: 10, spill: 50 } },
      { target: 'text:a', key: { color: '#00ff00', sim: 40, blend: 10, spill: 50 }, blend: 'multiply' },
      { target: 'adjust:z', reverse: true, mask: { shape: 'ellipse', x: 50, y: 50, w: 40, h: 40, rot: 0, feather: 0 } },
      ...Array.from({ length: 7 }, (_, i) => ({ target: `text:t${i}`, blend: 'screen' as const })),
    ]
    const out = normalizeLayerFx(raw)!
    const video = out.find((r) => r.target === 'video')!
    expect(video.mask).toBeTruthy()
    expect(video.key).toBeTruthy()
    expect(video.blend).toBeUndefined()
    expect(video.reverse).toBeUndefined()
    expect(out.find((r) => r.target === 'text:a')!.key).toBeUndefined()
    expect(out.filter((r) => r.target.startsWith('text:')).length).toBe(6)
  })

  it('broll-only snapshot unchanged', () => {
    const brollOnly = [
      { target: 'broll:a', mask: { shape: 'ellipse', x: 500, feather: -3, keys: [{ ms: 5.4, x: 1 }, { ms: -1 }] }, blend: 'normal' },
      { target: 'broll:b', key: { color: '#00FF00', sim: '70' }, blend: 'screen', reverse: true },
    ]
    expect(normalizeLayerFx(brollOnly)).toEqual([
      { target: 'broll:a', mask: { shape: 'ellipse', x: 150, y: 50, w: 60, h: 40, rot: 0, feather: 0, keys: [{ ms: 5, x: 1, y: 50, w: 60, h: 40, rot: 0, feather: 0 }] } },
      { target: 'broll:b', key: { color: '#00ff00', sim: 70, blend: 10, spill: 50 }, blend: 'screen', reverse: true },
    ])
  })

  it('setLayerFx on video target', () => {
    const list = setLayerFx(undefined, 'video', { key: { color: '#00ff00', sim: 40, blend: 10, spill: 50 } })
    expect(layerFxOf({ layerFx: list }, 'video')?.key?.color).toBe('#00ff00')
    expect(setLayerFx(list, 'video', null)).toBeUndefined()
  })

  it('round-trips through normalizeEdits', () => {
    const e = normalizeEdits(
      { ...defaultEdits(bounds), layerFx: [{ target: 'video', mask: { shape: 'rect', x: 50, y: 50, w: 60, h: 40, rot: 0, feather: 10 } }] },
      bounds,
    )
    expect(layerFxOf(e, 'video')?.mask?.shape).toBe('rect')
  })
})
