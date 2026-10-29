// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { render } from '@testing-library/react'
import { CAPTION_PRESETS, presetSlugToId, resolveCaptionPreset } from '@/lib/clips/caption-presets'
import { CaptionOverlay } from '@/components/clips/editor/caption-overlay'
import { cssEmPerAssFontsize, previewCaptionStrokePx } from '@/lib/clips/caption-fonts'
import { previewCaptionBottomPct, previewCaptionTopPct } from '@/lib/clips/caption-safe-area'
import { defaultEdits, normalizeEdits, type ClipEditsV2 } from '@/lib/clips/edits'

const bounds = { clipStartMs: 0, clipEndMs: 60_000 }
const words = [{ w: 'TEST', s: 0, e: 1, idx: 0 }]

describe('CaptionOverlay WYSIWYG', () => {
  const presets = CAPTION_PRESETS
  const styles = ['color', 'highlight', 'fill'] as const
  const positions = ['bottom', 'middle', 'top'] as const

  for (const p of presets) {
    for (const activeStyle of styles) {
      for (const position of positions) {
        it(`${p.slug} ${activeStyle} ${position}`, () => {
          const presetId = presetSlugToId(p.slug)
          const edits = normalizeEdits(
            {
              ...defaultEdits(bounds),
              captions: {
                ...defaultEdits(bounds).captions,
                presetId,
                size: p.sizePct,
                activeStyle,
                position,
              },
            },
            bounds,
          )
          const { container } = render(
            <div className="[--font-poppins:var(--font-poppins)]" style={{ ['--font-poppins' as string]: 'Poppins' }}>
              <CaptionOverlay words={words} currentTimeSec={0.2} edits={edits} boxHeightPx={640} />
            </div>,
          )
          const line = container.querySelector('[class*="z-[25]"]') as HTMLElement | null
          expect(line?.style.fontFamily).toContain('var(--font-poppins)')
          expect(line?.style.fontWeight).toBe('800')
          const resolved = resolveCaptionPreset(edits.captions)
          const sizePct = edits.captions?.size ?? resolved.sizePct
          const ratio = cssEmPerAssFontsize(resolved.font)
          const expectedSize = (640 * sizePct) / 100 * ratio
          const span = container.querySelector('[class*="z-[25]"] span.inline-block') as HTMLElement | null
          expect(span).toBeTruthy()
          expect(Math.abs(Number.parseFloat(span!.style.fontSize) - expectedSize)).toBeLessThanOrEqual(0.5)
          if (activeStyle !== 'highlight') {
            expect(span!.style.paintOrder).toBe('stroke fill')
            expect(previewCaptionStrokePx(resolved.outlineW, 640, 1280)).toBe(
              2 * resolved.outlineW * (640 / 1280),
            )
          }
          if (position === 'top') {
            expect(line?.style.top).toBe(`${previewCaptionTopPct(edits.captions, 1280)}%`)
          }
          if (position === 'bottom') {
            expect(line?.style.bottom).toBe(`${previewCaptionBottomPct(edits.captions, 1280)}%`)
          }
        })
      }
    }
  }

  it('resolveCaptionPreset merges presetConfig primary', () => {
    const merged = resolveCaptionPreset({ presetId: 'clean_white', presetConfig: { primary: '#FF00AA' } })
    expect(merged.primary).toBe('#FF00AA')
  })
})
