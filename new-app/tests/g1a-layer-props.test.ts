import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { defaultEdits, editsPayloadForSave, isDefaultEdits, normalizeEdits, type ClipEditsV2 } from '@/lib/clips/edits'
import { normalizeKeyframeTracks, normalizeLayerProps, stackOrder, propsForTarget } from '@/lib/clips/editor/motion-schema'
import { reconcileLayerProps } from '@/lib/clips/editor/keyframes'
import {
  cropClipPath,
  flipCss,
  intersectClipPaths,
  layerCropAt,
  layerFlip,
  layerZ,
  moveInStack,
  orderedStack,
  screenToMediaCrop,
  setCropAt,
  setLayerFlip,
  stackMoves,
} from '@/lib/clips/editor/layer-props'
import { buildTextItemsAss } from '@/lib/clips/render-plan/text-items-ass'

/** G1a parity with worker/clips_worker/motion.py — the same JSON is asserted by test_g1a_layer_fx.py. */
const here = path.dirname(fileURLToPath(import.meta.url))
const FX = JSON.parse(readFileSync(path.resolve(here, '../../worker/tests/fixtures/g1a_layer_parity.json'), 'utf8'))
const bounds = { clipStartMs: 0, clipEndMs: 10000 }
const base = (): ClipEditsV2 => normalizeEdits(defaultEdits(bounds), bounds)
const r4 = (o: Record<string, number>) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, Math.round(v * 1e4) / 1e4]))

describe('G1a parity fixture', () => {
  it('crop', () => {
    for (const c of FX.crop) {
      const e = { ...base(), keyframes: normalizeKeyframeTracks(c.edits.keyframes) }
      expect(r4(layerCropAt(e, c.target, c.tMs)), c.name).toEqual(c.expect)
    }
  })
  it('layerProps normalization', () => {
    for (const c of FX.layerProps) expect(normalizeLayerProps(c.raw) ?? [], c.name).toEqual(c.expect)
  })
  it('stack order', () => {
    for (const c of FX.stack) expect(stackOrder(c.items, (id) => c.z[id] ?? 0).map((i: { id: string }) => i.id), c.name).toEqual(c.expect)
  })
})

describe('G1a layer ops', () => {
  it('crop props only on picture layers', () => {
    expect(propsForTarget('video')).toContain('cropL')
    expect(propsForTarget('broll:a')).toContain('cropB')
    expect(propsForTarget('text:a')).not.toContain('cropL')
    expect(propsForTarget('text')).not.toContain('cropL')
  })
  it('crop + flip CSS, and screen ↔ media crop under a flip', () => {
    let e = setCropAt(base(), 'video', 0, { l: 10, b: 20 })
    e = setLayerFlip(e, 'video', 'h', true)
    expect(cropClipPath(layerCropAt(e, 'video', 0))).toBe('inset(0% 0% 20% 10%)')
    expect(flipCss(layerFlip(e, 'video'))).toBe('scale(-1, 1)')
    expect(screenToMediaCrop({ l: 5, r: 0, t: 0, b: 0 }, { h: true, v: false })).toEqual({ l: 0, r: 5, t: 0, b: 0 })
    expect(intersectClipPaths('inset(0% 0% 20% 10%)', 'inset(0% 50% 0% 0%)')).toBe('inset(0% 50% 20% 10%)')
    expect(setLayerFlip(e, 'video', 'h', false).layerProps).toBeUndefined()
    expect(setLayerFlip(base(), 'text:a', 'h', true)).toEqual(base())
  })
  it('bring forward / send back among overlapping layers only', () => {
    const e: ClipEditsV2 = {
      ...base(),
      textItems: [
        { id: 'a', text: 'A', startMs: 0, endMs: 2000, x: 50, y: 50, style: {} },
        { id: 'b', text: 'B', startMs: 500, endMs: 1500, x: 50, y: 50, style: {} },
        { id: 'c', text: 'C', startMs: 5000, endMs: 6000, x: 50, y: 50, style: {} },
      ] as ClipEditsV2['textItems'],
    }
    expect(stackMoves(e, 'text:c')).toEqual({ forward: false, backward: false, front: false, back: false })
    expect(stackMoves(e, 'text:a')).toEqual({ forward: true, backward: false, front: true, back: false })
    const up = moveInStack(e, 'text:a', 'forward')
    expect(layerZ(up, 'text:a')).toBe(1)
    expect(orderedStack(up, 'text', up.textItems!).map((t) => t.id)).toEqual(['b', 'a', 'c'])
    const back = moveInStack(up, 'text:a', 'back')
    expect(orderedStack(back, 'text', back.textItems!).map((t) => t.id)).toEqual(['a', 'b', 'c'])
    // Export builder follows the same order (b first, a on top with its own layer pair).
    const ass = buildTextItemsAss(JSON.parse(JSON.stringify(up)), 1080, 1920)!
    const ev = ass.split('\n').filter((l) => l.startsWith('Dialogue:'))
    expect(ev[0]).toMatch(/^Dialogue: 1,.*,T0,.*B$/)
    expect(ev[1]).toMatch(/^Dialogue: 3,.*,T1,.*A$/)
  })
  it('save payload, defaults and normalization', () => {
    const e = setLayerFlip(base(), 'video', 'v', true)
    expect(isDefaultEdits(e, bounds)).toBe(false)
    expect(normalizeEdits(JSON.parse(JSON.stringify(e)), bounds).layerProps).toEqual([{ target: 'video', flipV: true }])
    expect(editsPayloadForSave(base()).layerProps).toBeNull()
  })
  it('split children inherit flip / z, deleted layers drop theirs', () => {
    const prev: ClipEditsV2 = {
      ...base(),
      broll: [{ id: 'x', source: 'stock', assetId: 'a', startMs: 0, endMs: 4000 }],
      layerProps: [{ target: 'broll:x', flipH: true }],
    }
    const split: ClipEditsV2 = {
      ...prev,
      broll: [
        { id: 'x', source: 'stock', assetId: 'a', startMs: 0, endMs: 2000 },
        { id: 'x~2000', source: 'stock', assetId: 'a', startMs: 2000, endMs: 4000, inMs: 2000 },
      ],
    }
    expect(reconcileLayerProps(prev, split).layerProps).toEqual([
      { target: 'broll:x', flipH: true },
      { target: 'broll:x~2000', flipH: true },
    ])
    expect(reconcileLayerProps(prev, { ...prev, broll: [] }).layerProps).toBeUndefined()
  })
})
