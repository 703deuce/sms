import { describe, expect, it } from 'vitest'
import { renderScriptPdf } from '@/lib/screenwriting/pdf/render'
import { fountainToPmJson } from '@/lib/screenwriting/fountain/convert'

describe('PDF export', () => {
  it('renders in-memory PDF with embedded pages', async () => {
    const doc = fountainToPmJson('INT. ROOM - DAY\n\nAction.\n\nJACK\nHi.')
    const buf = await renderScriptPdf(doc, { title: 'Test', includeTitlePage: true })
    expect(buf.length).toBeGreaterThan(500)
    expect(buf.subarray(0, 5).toString()).toBe('%PDF-')
  })
})
