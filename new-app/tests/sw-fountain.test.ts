import { describe, expect, it } from 'vitest'
import { fountainToPmJson, pmJsonToFountain, pmJsonToPlainTxt } from '@/lib/screenwriting/fountain/convert'
import { parseFountain } from '@/lib/screenwriting/fountain/parse'

const SAMPLE = `INT. HOUSE - DAY

JANE
Hello world.

EXT. STREET - NIGHT

> CUT TO:
`

describe('Fountain W3', () => {
  it('parses scene and dialogue', () => {
    const blocks = parseFountain(SAMPLE)
    expect(blocks.some((b) => b.type === 'sceneHeading' && /INT\. HOUSE/.test(b.text))).toBe(true)
    expect(blocks.some((b) => b.type === 'character' && b.text === 'JANE')).toBe(true)
    expect(blocks.some((b) => b.type === 'dialogue' && b.text.includes('Hello'))).toBe(true)
  })

  it('round-trips through pmJson', () => {
    const doc = fountainToPmJson(SAMPLE)
    const back = pmJsonToFountain(doc)
    expect(back).toContain('INT. HOUSE')
    expect(back).toContain('JANE')
    const txt = pmJsonToPlainTxt(doc)
    expect(txt).toContain('Hello world')
  })
})
