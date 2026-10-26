import { describe, expect, it } from 'vitest'
import { normalizeScreenplayDoc } from '@/lib/screenwriting/schema/normalize-doc'
import { pdfLineBox } from '@/lib/screenwriting/pdf/line-position'
import { FEATURE_FORMAT_SPEC } from '@/lib/screenwriting/formats/feature'
import { fountainToPmJson } from '@/lib/screenwriting/fountain/convert'
import { suggestionsForElement } from '@/components/screenwriting/smarttype-menu'
import { DEFAULT_SMARTTYPE } from '@/lib/screenwriting/smarttype/store'

describe('P0 screenplay editor', () => {
  it('[U] normalizes empty doc to screenplay element', () => {
    const doc = normalizeScreenplayDoc({ type: 'doc', content: [] })
    expect(doc.content?.[0]?.type).toBe('screenplayElement')
  })

  it('[U] PDF character line is indented', () => {
    const box = pdfLineBox(FEATURE_FORMAT_SPEC, 'character')
    const action = pdfLineBox(FEATURE_FORMAT_SPEC, 'action')
    expect(box.x).toBeGreaterThan(action.x)
  })

  it('[U] smarttype suggests INT for scene heading', () => {
    const items = suggestionsForElement(DEFAULT_SMARTTYPE, 'sceneHeading', 'IN')
    expect(items.some((i) => i.startsWith('INT'))).toBe(true)
  })

  it('[U] fountain doc paginates with scene heading', () => {
    const doc = fountainToPmJson('INT. HOUSE - DAY\n\nAction.\n\nJACK\nHello.\n')
    expect(doc.content?.some((n) => n.attrs?.elementType === 'sceneHeading')).toBe(true)
  })
})
