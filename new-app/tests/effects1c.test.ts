import { describe, expect, it } from 'vitest'
import { newTemplateItems, normalizeTextItems, TITLE_TEMPLATES } from '@/lib/clips/editor/text-items'
import { CATALOG_TEMPLATES, TEMPLATE_CATEGORIES } from '@/lib/clips/editor/text-templates-catalog'

let n = 0
const mk = () => `t${n++}`

describe('EFFECTS1c template catalog', () => {
  it('has unique ids and ≥4 templates in every category', () => {
    const ids = TITLE_TEMPLATES.map((t) => t.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const c of TEMPLATE_CATEGORIES) expect(CATALOG_TEMPLATES.filter((t) => t.category === c).length).toBeGreaterThanOrEqual(4)
  })
  it('every template inserts items that survive the real normaliser (so export renders them)', () => {
    for (const t of CATALOG_TEMPLATES) {
      const items = newTemplateItems(t.id, mk, 1000, 20000)
      expect(items.length).toBe(t.parts.length)
      expect(normalizeTextItems(items, 20000)?.length).toBe(items.length)
    }
  })
  it('countdown parts get their own 1 s windows', () => {
    const items = newTemplateItems('c_cd_321', mk, 0, 20000)
    expect(items.map((i) => [i.startMs, i.endMs])).toEqual([[0, 1000], [1000, 2000], [2000, 3000]])
  })
})
