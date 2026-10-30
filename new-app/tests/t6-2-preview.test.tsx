// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import { TemplateStage } from '@/components/clips/editor/template-stage'
import { resolveTemplateGeometryById } from '@/lib/clips/templates/geometry'
import { signalsOrDefaults } from '@/lib/clips/templates/signals'
import { effectiveCaptionEdits } from '@/lib/clips/caption-v2-bridge'

describe('T6.2 template stage', () => {
  it('re-render keeps template stage visible with non-zero panel width', () => {
    const spec = resolveTemplateGeometryById('G4', signalsOrDefaults({ clipType: 'gaming' }), {
      layout: { mode: 'fit_blur', shotOverrides: [], template: { id: 'G4' } },
      trim: { in: 0, out: 6000 },
    } as never)
    if (!spec) throw new Error('no spec')
    const { rerender, container } = render(
      <TemplateStage spec={spec} videoUrl="/clips/sample-preview.mp4" posterUrl={null} />,
    )
    const stage = container.querySelector('[data-testid="template-stage"]') as HTMLElement
    expect(stage).toBeTruthy()
    const spec2 = resolveTemplateGeometryById('G1', signalsOrDefaults({ clipType: 'gaming' }), {
      layout: { mode: 'fit_blur', shotOverrides: [], template: { id: 'G1' } },
      trim: { in: 0, out: 6000 },
    } as never)
    rerender(<TemplateStage spec={spec2!} videoUrl="/clips/sample-preview.mp4" posterUrl={null} />)
    const panel = container.querySelector('[data-testid="template-stage"] div[style*="width"]') as HTMLElement
    expect(Number.parseFloat(panel?.style.width || '0')).toBeGreaterThan(0)
  })
})

describe('T6.2 effectiveCaptionEdits', () => {
  it('strips stale keys for cp presets', () => {
    const out = effectiveCaptionEdits(
      {
        presetId: 'cp11',
        presetConfig: { primary: '#fff' },
        colors: { a: '#FFD93D' },
        size: 6.5,
      },
      true,
    )
    expect(out.presetId).toBe('cp11')
    expect('presetConfig' in out).toBe(false)
    expect('colors' in out).toBe(false)
  })
})
