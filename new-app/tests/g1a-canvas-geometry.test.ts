import { describe, expect, it } from 'vitest'
import {
  applyTransform,
  contentQuad,
  cropTo,
  invertTransform,
  moveTo,
  parseOrigin,
  pointInLayer,
  quadBounds,
  rotateTo,
  scaleTo,
  snapMove,
  snapRotation,
  type LayerGeom,
} from '@/lib/clips/editor/canvas-geometry'
import { defaultEdits, normalizeEdits } from '@/lib/clips/edits'
import { brollFrame, mainFrame } from '@/lib/clips/editor/motion-frame'
import { setCropAt, setLayerFlip } from '@/lib/clips/editor/layer-props'

const el = { x: 0, y: 0, w: 200, h: 400 }
const geom = (t: Partial<LayerGeom['t']> = {}): LayerGeom => ({
  el,
  origin: { x: 100, y: 200 },
  content: el,
  t: { x: 0, y: 0, scale: 100, rotation: 0, opacity: 100, ...t },
})
const near = (a: number, b: number, eps = 1e-6) => expect(Math.abs(a - b)).toBeLessThan(eps)

describe('G1a canvas geometry', () => {
  it('forward / inverse transform round-trip (same affine map as transformCss)', () => {
    const g = geom({ x: 10, y: -5, scale: 150, rotation: 30 })
    const p = { x: 37, y: 91 }
    const q = invertTransform(g, applyTransform(g, p))
    near(q.x, p.x)
    near(q.y, p.y)
    // translate % is of the element size
    const c = applyTransform(geom({ x: 10, y: -5 }), { x: 100, y: 200 })
    expect(c).toEqual({ x: 120, y: 180 })
  })
  it('hit test follows rotation / scale', () => {
    const g = geom({ scale: 50 })
    expect(pointInLayer(g, { x: 100, y: 200 })).toBe(true)
    expect(pointInLayer(g, { x: 10, y: 10 })).toBe(false)
  })
  it('move → x / y %, snapping to the frame centre with a guide', () => {
    expect(moveTo(geom(), 20, -40)).toEqual({ x: 10, y: -10 })
    const b = quadBounds(contentQuad(geom({ scale: 50 })))
    const s = snapMove({ ...b, x: b.x + 3 }, { w: 200, h: 400 })
    expect(s.dx).toBe(-3)
    expect(s.guides.some((g) => g.axis === 'x' && g.at === 100)).toBe(true)
    expect(snapMove({ x: 31, y: 77, w: 10, h: 10 }, { w: 200, h: 400 }).guides).toEqual([])
  })
  it('corner drag scales uniformly, rotate handle rotates (with snaps)', () => {
    expect(scaleTo(geom(), { x: 200, y: 200 }, { x: 250, y: 200 })).toBe(150)
    expect(rotateTo(geom(), { x: 200, y: 200 }, { x: 100, y: 300 })).toBe(90)
    expect(snapRotation(44, true)).toBe(45)
    expect(snapRotation(2, false)).toBe(0)
  })
  it('crop edges map the pointer back through the transform', () => {
    const c = cropTo(geom(), { l: 0, t: 0, r: 0, b: 0 }, 'l', { x: 50, y: 200 })
    expect(c.l).toBe(25)
    // rotated 90°: dragging along screen y moves the layer's left edge
    const g = geom({ rotation: 90 })
    const c2 = cropTo(g, { l: 0, t: 0, r: 0, b: 0 }, 'l', applyTransform(g, { x: 40, y: 200 }))
    near(c2.l, 20, 1e-9)
    expect(cropTo(geom(), { l: 80, t: 0, r: 0, b: 0 }, 'r', { x: 0, y: 0 }).r).toBe(15)
  })
  it('parses transform-origin', () => {
    expect(parseOrigin('50% 11%', { x: 0, y: 0, w: 100, h: 200 })).toEqual({ x: 50, y: 22 })
  })
})

describe('G1a preview frame: crop + flip match the export order', () => {
  const bounds = { clipStartMs: 0, clipEndMs: 10000 }
  const base = () => normalizeEdits(defaultEdits(bounds), bounds)
  it('main video: clip-path inset + flip as the last transform function', () => {
    let e = setCropAt(base(), 'video', 0, { l: 10, t: 5 })
    e = setLayerFlip(e, 'video', 'h', true)
    const f = mainFrame(e, { segs: [[0, 10000]], starts: [0], durationMs: 10000 }, 0, 360)
    expect(f.kf.clipPath).toBe('inset(5% 0% 0% 10%)')
    expect(f.kf.transform).toBe('scale(-1, 1)')
  })
  it('B-roll: crop intersects a wipe; the wipe is un-mirrored on a flipped item', () => {
    let e = {
      ...base(),
      broll: [{ id: 'b', source: 'stock' as const, assetId: 'a', startMs: 1000, endMs: 3000, transitionIn: { type: 'wipe_left' as const, durMs: 400 } }],
    }
    e = setCropAt(e, 'broll:b', 0, { t: 10 })
    const plain = brollFrame(e, 1100, 360).items.b!.box!
    const flipped = brollFrame(setLayerFlip(e, 'broll:b', 'h', true), 1100, 360).items.b!.box!
    expect(plain.clipPath).toMatch(/^inset\(10% 0% 0% [\d.]+%\)$/)
    // wipe_left clips the left side on screen → for a flipped element that is the element's right inset
    expect(flipped.clipPath).toMatch(/^inset\(10% [\d.]+% 0% 0%\)$/)
    expect(flipped.transform.endsWith('scale(-1, 1)')).toBe(true)
  })
})
