// @vitest-environment happy-dom
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { render } from '@testing-library/react'
import { resolveTemplateGeometryById } from '@/lib/clips/templates/geometry'
import { signalsOrDefaults } from '@/lib/clips/templates/signals'
import { T6_TEMPLATES_BY_ID } from '@/lib/clips/templates/registry'
import { templateNeedsDetectedFace } from '@/lib/clips/templates/pick'
import { TemplateLayoutPanel } from '@/components/clips/editor/template-layout-panel'

const FC = { x: 0, y: 0.7104, w: 0.7, h: 0.2896 }
const GP = { x: 0, y: 0, w: 1, h: 0.7104 }
const FACE = { x: 0.326, y: 0.7878, w: 0.0386, h: 0.0865, persist: 1, score: 0.9 }

const meta = (faces: unknown[] | undefined, clipType = 'gaming') => ({
  clipType,
  facecamLayout: { facecam: FC, gameplay: GP, confidence: 0.9 },
  signals: { v: 1, clip_type: clipType, type_conf: 0.9, facecam_box: FC, facecam_conf: 0.9, ...(faces ? { faces } : {}) },
})
const edits = (id: string, extra: Record<string, unknown> = {}) =>
  ({ layout: { mode: 'fit_blur', shotOverrides: [], template: { id } }, trim: { in: 0, out: 6000 }, ...extra }) as never

const inside = (b: { x: number; y: number; w: number; h: number }, x: number, y: number) =>
  b.x <= x && x <= b.x + b.w && b.y <= y && y <= b.y + b.h

describe('T6.3 face-aware geometry (parity with t6_geometry.py)', () => {
  it('G6 face panel is a crop around the detected face inside the facecam', () => {
    const spec = resolveTemplateGeometryById('G6', signalsOrDefaults(meta([FACE])), edits('G6'))!
    const src = spec.panels[0].src
    expect(inside(src, FACE.x + FACE.w / 2, FACE.y + FACE.h / 2)).toBe(true)
    expect(src.h).toBeLessThanOrEqual(FC.h + 1e-6)
  })
  it('G6 game panel excludes the facecam strip (facecamLayout.gameplay)', () => {
    const spec = resolveTemplateGeometryById('G6', signalsOrDefaults(meta([FACE])), edits('G6'))!
    const g = spec.panels[1].src
    expect(g.y + g.h).toBeLessThanOrEqual(GP.h + 1e-3)
  })
  it('dragging the facecam box changes the G6 face panel', () => {
    const s = signalsOrDefaults(meta([FACE]))
    const a = resolveTemplateGeometryById('G6', s, edits('G6'))!.panels[0].src
    const e2 = edits('G6')
    ;(e2 as { layout: Record<string, unknown> }).layout.facecam = { box: { x: 0.05, y: 0.75, w: 0.2, h: 0.2 } }
    const b = resolveTemplateGeometryById('G6', s, e2)!.panels[0].src
    expect(b).not.toEqual(a)
  })
  it('I5 without a detected person is the whole frame (contain_blur)', () => {
    const spec = resolveTemplateGeometryById('I5', signalsOrDefaults(meta([], 'irl')), edits('I5'))!
    for (const p of spec.panels) {
      expect(p.src.w).toBeGreaterThanOrEqual(0.999)
      expect(p.fit).toBe('contain_blur')
    }
  })
  it('person/face templates require a detected face', () => {
    expect(templateNeedsDetectedFace(T6_TEMPLATES_BY_ID.I5)).toBe(true)
    expect(templateNeedsDetectedFace(T6_TEMPLATES_BY_ID.G3)).toBe(false)
  })
})

describe('T6.3 template family dropdown', () => {
  beforeAll(() => {
    vi.stubEnv('NEXT_PUBLIC_T6_TEMPLATES', '1')
  })
  it('renders the family select with the current lane and lane tiles', () => {
    const { container } = render(
      <TemplateLayoutPanel edits={edits('G1')} onEdits={() => {}} aiMeta={meta([FACE])} videoUrl={null} />,
    )
    expect(container.querySelector('[data-testid="template-family"]')).toBeTruthy()
    expect(container.querySelector('[data-testid="template-tile-G1"]')).toBeTruthy()
    expect(container.querySelector('[data-testid="template-tile-I1"]')).toBeNull()
  })
})
