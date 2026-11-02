/** @vitest-environment jsdom */
import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { CatalogTplThumb } from '@/lib/clips/templates/catalog-thumb'
import { buildTemplateCatalog } from '@/lib/clips/templates/catalog'

describe('template hub schematic previews', () => {
  it('layout, layout_template, and multicam cards render at least one region', () => {
    const kinds = new Set(['layout', 'layout_template', 'multicam'])
    const items = buildTemplateCatalog().filter((i) => kinds.has(i.kind))
    expect(items.length).toBeGreaterThan(10)
    for (const item of items) {
      const { container } = render(<CatalogTplThumb item={item} />)
      const regions = container.querySelectorAll('[data-region]')
      expect(regions.length, `${item.kind}:${item.id}`).toBeGreaterThanOrEqual(1)
    }
  })
})
