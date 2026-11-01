import { describe, expect, it } from 'vitest'
import { normalizeTextItems, TEXT_FONTS, TEXT_PRESETS, TITLE_TEMPLATES } from '@/lib/clips/editor/text-items'

const FONT_IDS = new Set(TEXT_FONTS.map((f) => f.id))
const STYLE_KEYS = new Set([
  'font',
  'size',
  'color',
  'align',
  'case',
  'stroke',
  'shadow',
  'box',
  'fontFamily',
  'letterSpacing',
  'lineHeight',
  'gradient',
])

describe('WordArt presets', () => {
  const wa = TEXT_PRESETS.filter((p) => p.id.startsWith('wa_'))

  it('includes six WordArt presets', () => {
    expect(wa).toHaveLength(6)
    expect(wa.every((p) => p.label.startsWith('WordArt ·'))).toBe(true)
  })

  it('uses bundled fonts and known style keys only', () => {
    for (const p of wa) {
      expect(FONT_IDS.has(p.style.font)).toBe(true)
      for (const key of Object.keys(p.style)) {
        expect(STYLE_KEYS.has(key)).toBe(true)
      }
    }
  })

  it('speech_bubble template has two parts', () => {
    const tpl = TITLE_TEMPLATES.find((t) => t.id === 'speech_bubble')
    expect(tpl?.label).toBe('Speech bubble')
    expect(tpl?.parts).toHaveLength(2)
    expect(tpl?.parts[0]?.kind).toBe('shape')
    expect(tpl?.parts[1]?.text).toBe('Say something!')
  })

  it('normalize round-trips each WordArt preset style', () => {
    for (const p of wa) {
      const items = normalizeTextItems([
        {
          id: 't1',
          text: 'Hi',
          startMs: 0,
          endMs: 3000,
          x: 50,
          y: 50,
          style: p.style,
          presetId: p.id,
        },
      ])
      expect(items?.[0]?.style).toEqual(p.style)
    }
  })
})
