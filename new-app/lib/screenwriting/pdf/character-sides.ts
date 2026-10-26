import type { JSONContent } from '@tiptap/core'
import PDFDocument from 'pdfkit'

export function extractCharacterSides(doc: JSONContent, character: string): string[] {
  const lines: string[] = []
  const target = character.trim().toUpperCase()
  let current = ''
  for (const n of doc.content ?? []) {
    if (n.type !== 'screenplayElement') continue
    const t = n.attrs?.elementType as string
    const text = (n.content ?? []).map((c) => (c.type === 'text' ? c.text ?? '' : '')).join('')
    if (t === 'character') current = text.trim().toUpperCase()
    if (t === 'dialogue' && current === target) lines.push(text)
  }
  return lines
}

export async function renderCharacterSidesPdf(
  doc: JSONContent,
  character: string,
  title?: string,
): Promise<Buffer> {
  const lines = extractCharacterSides(doc, character)
  const pdf = new PDFDocument({ size: 'LETTER', margin: 72 })
  const chunks: Buffer[] = []
  pdf.on('data', (c: Buffer) => chunks.push(c))
  pdf.font('Courier').fontSize(12)
  pdf.text(title || `${character} — Sides`, { align: 'center' })
  pdf.moveDown()
  for (const line of lines) {
    pdf.text(line)
    pdf.moveDown(0.5)
  }
  if (!lines.length) pdf.text('(no dialogue for this character)')
  pdf.end()
  await new Promise<void>((resolve) => pdf.on('end', () => resolve()))
  return Buffer.concat(chunks)
}
