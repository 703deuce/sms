// @vitest-environment happy-dom
/** CV17c-fix3: libass text fx keeps a selection shell without painting duplicate glyphs. */
import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import { defaultEdits, normalizeEdits, type ClipEditsV2 } from '@/lib/clips/edits'
import { newTextItem } from '@/lib/clips/editor/text-items'
import { TextItemsPreview } from '@/components/clips/editor/text-items-preview'

const bounds = { clipStartMs: 0, clipEndMs: 20_000, trimMinMs: 0, trimMaxMs: 40_000 }
const base = (): ClipEditsV2 => normalizeEdits(defaultEdits(bounds), bounds)

describe('TextItemsPreview libass fx selection shell', () => {
  it('omits fx item ghost until canvas-selected, then marks shell', () => {
    const t = newTextItem('t1', 0, 20_000)
    const e = {
      ...base(),
      textItems: [t],
      layerFx: [{ target: 'text:t1', mask: { shape: 'ellipse', x: 50, y: 50, w: 15, h: 10, rot: 0, feather: 0 } }],
    } as ClipEditsV2
    const r0 = render(
      <TextItemsPreview edits={e} boxH={640} libassTextFx selectedId={null} canvasSelectedId={null} elRef={() => {}} />,
    )
    expect(r0.queryByTestId('preview-text-item')).toBeNull()
    r0.unmount()
    const r1 = render(
      <TextItemsPreview edits={e} boxH={640} libassTextFx canvasSelectedId="t1" elRef={() => {}} />,
    )
    const shell = r1.getByTestId('preview-text-item')
    expect(shell.getAttribute('data-text-fx-shell')).toBe('1')
    expect(shell.querySelector('[data-testid="preview-text-line"]')?.textContent).toContain('Your text')
  })
})
