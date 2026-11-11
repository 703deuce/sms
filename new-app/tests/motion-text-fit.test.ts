import { describe, expect, it } from 'vitest'
import { fitMotionTextToBox } from '@/lib/clips/motion-graphics/text-fit'
import { addTextBackedMotionPlan } from '@/lib/clips/motion-graphics/text-adapter'
import type { MotionPlan } from '@/lib/clips/motion-graphics/contract'
import { defaultEdits, normalizeEdits } from '@/lib/clips/edits'
import { exportPixelSize } from '@/lib/clips/export-aspect'

const TITLE = 'How one small editing decision changes the entire story without losing the words your audience needs to read'

function canonical(text: string): string {
  return text.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim()
}

describe('motion text fitting', () => {
  for (const format of ['9:16', '16:9'] as const) {
    for (const resolution of ['720p', '1080p'] as const) {
      it('fits a long title at ' + resolution + ' ' + format + ' without dropping text', () => {
        const fit = fitMotionTextToBox({
          text: TITLE,
          fontFamily: 'Montserrat',
          format,
          box: { width: 0.8, height: 0.26 },
          preferredSize: 220,
          edgeInsetPx: 12,
        })
        expect(fit.fits).toBe(true)
        expect(canonical(fit.text)).toBe(canonical(TITLE))
        expect(fit.text).toContain('\n')

        const output = exportPixelSize(format, resolution)
        const scale = output.height / 1920
        expect(fit.maxLineWidthPx * scale).toBeLessThanOrEqual(fit.boxWidthPx * scale)
        expect(fit.blockHeightPx * scale).toBeLessThanOrEqual(fit.boxHeightPx * scale)
      })
    }
  }

  it('stores the fitted line breaks and font size in the existing TextItem contract', () => {
    const bounds = { clipStartMs: 0, clipEndMs: 6000 }
    const edits = normalizeEdits(defaultEdits(bounds), bounds)
    const plan: MotionPlan = {
      version: 1,
      mode: 'single_source_story',
      styleProfileId: null,
      fps: 30,
      durationMs: 6000,
      format: '9:16',
      graphics: [{
        id: 'long_title',
        templateId: 'title_card',
        startMs: 500,
        endMs: 4000,
        text: TITLE,
        box: { x: 0.1, y: 0.15, width: 0.8, height: 0.26 },
        zIndex: 1,
        style: {
          textColor: '#FFFFFF',
          accentColor: '#22D3EE',
          backgroundColor: '#0F172A',
          fontFamily: 'Montserrat',
        },
        intro: { kind: 'fade', durationMs: 250, easing: 'out' },
        outro: { kind: 'fade', durationMs: 250, easing: 'in' },
        keyframes: [],
        assetIds: [],
        rationale: 'Readable title',
      }],
    }

    const result = addTextBackedMotionPlan(edits, plan)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const item = result.edits.textItems?.[0]
    expect(item?.id).toBe('mg_long_title')
    expect(item?.text).toContain('\n')
    expect(canonical(item?.text ?? '')).toBe(canonical(TITLE))
    expect(item?.style.font).toBe('Montserrat')
    expect(item?.style.size).toBeGreaterThanOrEqual(24)
    expect(item?.style.size).toBeLessThanOrEqual(240)
  })
})
