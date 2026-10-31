// @vitest-environment happy-dom
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { fireEvent, render } from '@testing-library/react'
import { editorTemplateSpec } from '@/lib/clips/templates/editor-spec'
import { resolveTemplateGeometryById } from '@/lib/clips/templates/geometry'
import { signalsOrDefaults } from '@/lib/clips/templates/signals'
import { FacecamLayoutStudio } from '@/components/clips/editor/facecam-layout-studio'
import { TemplateLayoutPanel } from '@/components/clips/editor/template-layout-panel'

// Clip A (Sonic stream, E2E fixture A_db): webcam strip bottom-left, streamer face right of a plush.
const FACECAM = { x: 0, y: 0.7304, w: 0.4396, h: 0.2576 }
const FACES = [
  { x: 0.326, y: 0.7878, w: 0.0386, h: 0.0865, persist: 1, score: 0.9 },
  { x: 0.0963, y: 0.8094, w: 0.0317, h: 0.0737, persist: 0.8, score: 0.9 },
]
const aiMeta = (faces: unknown[] | null) => ({
  clipType: 'gaming',
  signals: {
    v: 1, clip_type: 'gaming', type_conf: 1, facecam_box: FACECAM, facecam_conf: 0.957, person_count: 1,
    background_action: true, real_camera_footage: true, hud_at_edges: false, game_ui_visible: false,
    ...(faces ? { faces } : {}),
  },
})
const edits = (id: string, lane = 'gaming', mode = 'facecam_stack') =>
  ({
    v: 2,
    trim: { in: 0, out: 15698 },
    layout: { mode, shotOverrides: [], template: { id, auto: false, lane, reason: 'user_pick' } },
  }) as never

beforeAll(() => {
  vi.stubEnv('NEXT_PUBLIC_T6_TEMPLATES', '1')
})

describe('T6.5 one editor template spec', () => {
  it('editorTemplateSpec is exactly resolveTemplateGeometryById(signalsOrDefaults(aiMeta))', () => {
    for (const faces of [null, FACES]) {
      for (const id of ['G1', 'G6', 'C2']) {
        const m = aiMeta(faces)
        expect(editorTemplateSpec(edits(id), m)).toEqual(resolveTemplateGeometryById(id, signalsOrDefaults(m), edits(id)))
      }
    }
    expect(editorTemplateSpec({ layout: { mode: 'fit_blur', shotOverrides: [] } } as never, aiMeta(null))).toBeNull()
  })
  it('G6 face panel covers the streamer face (geometry.ts coverOnFaces), not the facecam-box centre', () => {
    const face = editorTemplateSpec(edits('G6'), aiMeta(FACES))!.panels[0]
    // facecam-box centre would be x=.1457 (the plush); face cover moves right onto the streamer
    expect(face.src.x).toBeCloseTo(0.272, 2)
    expect(face.src.x + face.src.w).toBeGreaterThan(FACES[0].x + FACES[0].w)
  })
  it('both editor previews consume editorTemplateSpec (they can never disagree)', () => {
    const dir = join(__dirname, '..', 'components', 'clips', 'editor')
    for (const f of ['preview-stage.tsx', 'facecam-layout-studio.tsx']) {
      const src = readFileSync(join(dir, f), 'utf8')
      expect(src).toContain('editorTemplateSpec(edits, aiMeta)')
      expect(src).not.toContain('resolveTemplateGeometryById(')
    }
  })
  it('layout studio 9:16 preview renders TemplateStage under a template', () => {
    const { container } = render(
      <FacecamLayoutStudio
        edits={edits('G6')}
        facecamLayout={null}
        onEdits={() => {}}
        videoUrl="https://example.test/a.mp4"
        posterUrl={null}
        aiMeta={aiMeta(FACES)}
      />,
    )
    const box = container.querySelector('[data-testid="studio-template-preview"]')
    expect(box).toBeTruthy()
    expect(box!.querySelector('[data-testid="template-stage"]')).toBeTruthy()
  })
  it('layout studio keeps the legacy preview when no template is set', () => {
    const { container } = render(
      <FacecamLayoutStudio
        edits={{ layout: { mode: 'facecam_stack', shotOverrides: [] }, trim: { in: 0, out: 6000 } } as never}
        facecamLayout={null}
        onEdits={() => {}}
        videoUrl="https://example.test/a.mp4"
        posterUrl={null}
      />,
    )
    expect(container.querySelector('[data-testid="studio-template-preview"]')).toBeNull()
  })
})

describe('T6.5 item 2: C2 on gaming clip A', () => {
  it('clicking C2 saves the template and the editor spec becomes one full-frame face panel', () => {
    const onEdits = vi.fn()
    const { getByTestId } = render(
      <TemplateLayoutPanel edits={edits('C1', 'podcast')} onEdits={onEdits} aiMeta={aiMeta(FACES)} videoUrl={null} />,
    )
    fireEvent.click(getByTestId('template-tile-C2'))
    expect(onEdits).toHaveBeenCalled()
    const next = onEdits.mock.calls.at(-1)![0]
    expect(next.layout.template.id).toBe('C2')
    const spec = editorTemplateSpec(next, aiMeta(FACES))!
    expect(spec.panels).toHaveLength(1)
    expect(spec.panels[0].dest).toMatchObject({ x: 0, y: 0, w: 1080, h: 1920 })
    expect(spec.panels[0].src.x).toBeCloseTo(0.3045, 3)
  })
})
