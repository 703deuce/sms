import { describe, expect, it } from 'vitest'
import { MAX_TITLE_ZOOM, resolveTemplateGeometryById } from '@/lib/clips/templates/geometry'
import { signalsOrDefaults } from '@/lib/clips/templates/signals'

// T6.6 (parity: worker/tests/test_t6_6.py): titled face crops stay inside the facecam box.
const BOX = { x: 0, y: 0.7304, w: 0.4396, h: 0.2576 }
const FACES = [
  { x: 0.326, y: 0.7878, w: 0.0386, h: 0.0865, persist: 1, score: 0.9 },
  { x: 0.0963, y: 0.8094, w: 0.0317, h: 0.0737, persist: 0.8, score: 0.9 },
]
const EPS = 1e-4
const meta = (box: typeof BOX | null = BOX) => ({
  clipType: 'gaming',
  signals: { v: 1, clip_type: 'gaming', type_conf: 1, facecam_conf: 0.95, person_count: 1, faces: FACES, ...(box ? { facecam_box: box } : {}) },
})
const edits = (id: string, title = true) =>
  ({
    layout: { mode: 'facecam_stack', shotOverrides: [], template: { id } },
    exportTemplate: { headlineBar: { enabled: title, text: 'Hello' } },
  }) as never
const facePanel = (id: string, title = true) => resolveTemplateGeometryById(id, signalsOrDefaults(meta()), edits(id, title))!.panels[0]
const inside = (s: { x: number; y: number; w: number; h: number }) =>
  s.x >= BOX.x - EPS && s.y >= BOX.y - EPS && s.x + s.w <= BOX.x + BOX.w + EPS && s.y + s.h <= BOX.y + BOX.h + EPS

describe('T6.6 face crop stays in the facecam box', () => {
  it.each(['G6', 'C1', 'C2', 'C4'])('%s with a title: inside the box, face below the title', (id: string) => {
    const p = facePanel(id)
    expect(inside(p.src)).toBe(true)
    const t = Math.max(0, Math.min(384, p.dest.y + p.dest.h) - p.dest.y) / p.dest.h
    expect((FACES[0].y - p.src.y) / p.src.h).toBeGreaterThanOrEqual(t - 0.02)
    expect(p.src.h).toBeGreaterThanOrEqual(BOX.h / MAX_TITLE_ZOOM - EPS)
  })
  it('G1: minimal spill, all of it under the title', () => {
    const p = facePanel('G1')
    const t = Math.min(384, p.dest.h) / p.dest.h
    const spill = Math.max(0, BOX.y - p.src.y) / p.src.h
    expect(spill).toBeGreaterThan(0)
    expect(spill).toBeLessThanOrEqual(t + EPS)
    expect(p.src.y).toBeGreaterThan(0.6342)
  })
  it.each(['G1', 'G6', 'C1', 'C2', 'C4'])('%s without a title stays inside', (id: string) => {
    expect(inside(facePanel(id, false).src)).toBe(true)
  })
})
