// @vitest-environment happy-dom
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { render } from '@testing-library/react'
import { T6_TEMPLATES_BY_ID, requiresForFamily, templatesForFamily } from '@/lib/clips/templates/registry'
import { eligibleTemplate, pickTemplate } from '@/lib/clips/templates/pick'
import { signalsOrDefaults } from '@/lib/clips/templates/signals'
import { TemplateLayoutPanel } from '@/components/clips/editor/template-layout-panel'
import { EditorHeadlineField, T6_TITLE_PLACEMENT_NOTE } from '@/components/clips/editor/editor-headline-field'

const FACE = { x: 0.3, y: 0.3, w: 0.1, h: 0.15, persist: 1, score: 0.9 }

describe('T6.4 template families', () => {
  it('every family lists at least 5 templates; podcast shares C1-C6', () => {
    for (const lane of ['gaming', 'irl', 'just_chatting', 'podcast']) {
      expect(templatesForFamily(lane).length).toBeGreaterThanOrEqual(5)
    }
    expect(templatesForFamily('podcast').map((t) => t.id)).toEqual(['C7', 'C8', 'C9', 'C1', 'C2', 'C3', 'C4', 'C5', 'C6'])
    expect(templatesForFamily('just_chatting').map((t) => t.id)).toEqual(['C1', 'C2', 'C3', 'C4', 'C5', 'C6'])
  })
  it('shared-family requirements (parity with t6_pick.requires_for_family)', () => {
    expect(requiresForFamily(T6_TEMPLATES_BY_ID.C1, 'just_chatting').maxPersons ?? null).toBeNull()
    expect(requiresForFamily(T6_TEMPLATES_BY_ID.C1, 'podcast').maxPersons).toBe(1)
    const s = { ...signalsOrDefaults({ clipType: 'podcast' }), faces: [FACE, FACE], person_count: 2, background_action: false }
    expect(eligibleTemplate(T6_TEMPLATES_BY_ID.C1, s, 0, 'just_chatting')).toBe(true)
    expect(eligibleTemplate(T6_TEMPLATES_BY_ID.C1, s, 0, 'podcast')).toBe(false)
  })
  it('podcast auto-pick prefers a native template when one is eligible', () => {
    const s = { ...signalsOrDefaults({ clipType: 'podcast' }), type_conf: 0.9, faces: [FACE, FACE], person_count: 2, background_action: false }
    const [id] = pickTemplate(s, {}, [], {}, 5, 'clip0')
    expect(T6_TEMPLATES_BY_ID[id].lane).toBe('podcast')
  })
})

describe('T6.4 family picker + copy', () => {
  beforeAll(() => {
    vi.stubEnv('NEXT_PUBLIC_T6_TEMPLATES', '1')
    vi.stubEnv('NEXT_PUBLIC_T6_TITLE_AUTO', '1')
  })
  const edits = (id: string, lane?: string) =>
    ({ layout: { mode: 'fit_blur', shotOverrides: [], template: { id, lane } }, trim: { in: 0, out: 6000 } }) as never

  it('a shared template picked from Podcast keeps the Podcast family and lists 9 tiles', () => {
    const { container } = render(
      <TemplateLayoutPanel edits={edits('C2', 'podcast')} onEdits={() => {}} aiMeta={{ clipType: 'podcast' }} videoUrl={null} />,
    )
    expect(container.querySelectorAll('[data-testid^="template-tile-"]').length).toBe(9)
    expect(container.querySelector('[data-testid="template-tile-C7"]')).toBeTruthy()
  })
  it('Layers headline note uses the T6 title copy', () => {
    const { getByTestId } = render(
      <EditorHeadlineField clipId="c" edits={{ layout: { mode: 'fit_blur' }, exportTemplate: {} } as never} onEdits={() => {}} />,
    )
    expect(getByTestId('headline-placement-note').textContent).toContain(T6_TITLE_PLACEMENT_NOTE)
  })
})
