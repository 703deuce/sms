import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { parseFdx } from '@/lib/screenwriting/fdx/parse'
import { pmJsonToFdx } from '@/lib/screenwriting/fdx/serialize'
import { layoutElementsFromPmJson, paginateFromElements } from '@/lib/screenwriting/layout'
import { FEATURE_FORMAT_SPEC } from '@/lib/screenwriting/formats/feature'

const FIXTURE = join(process.cwd(), 'lib/screenwriting/__fixtures__/Brick-&-Steel.fdx')

describe('FDX', () => {
  it('round-trips structural XML', () => {
    const sample = `<?xml version="1.0"?>
<FinalDraft DocumentType="Script" Template="No" Version="5">
  <Content>
    <Paragraph Type="Scene Heading"><Text>INT. TEST - DAY</Text></Paragraph>
    <Paragraph Type="Action"><Text>Hello.</Text></Paragraph>
  </Content>
</FinalDraft>`
    const { pmJson } = parseFdx(sample)
    const out = pmJsonToFdx(pmJson)
    expect(out).toContain('Scene Heading')
    expect(out).toContain('INT. TEST - DAY')
    const again = parseFdx(out)
    expect(again.pmJson.content?.length).toBe(2)
  })

  it('imports Brick & Steel fixture when present', () => {
    if (!existsSync(FIXTURE)) {
      expect(true).toBe(true)
      return
    }
    const xml = readFileSync(FIXTURE, 'utf8')
    const { pmJson } = parseFdx(xml)
    const layout = paginateFromElements(layoutElementsFromPmJson(pmJson), {
      spec: FEATURE_FORMAT_SPEC,
      bodyLinesPerPage: 54,
    })
    expect(layout.pageCount).toBeGreaterThanOrEqual(1)
  })
})
