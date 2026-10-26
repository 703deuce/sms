import type { JSONContent } from '@tiptap/core'
import { Document, Packer, Paragraph, TextRun } from 'docx'

function nodeText(node: JSONContent): string {
  if (!node.content) return ''
  return node.content.map((c) => (c.type === 'text' ? c.text ?? '' : '')).join('')
}

export async function pmJsonToDocxBuffer(doc: JSONContent): Promise<Buffer> {
  const children: Paragraph[] = []
  for (const n of doc.content ?? []) {
    if (n.type !== 'screenplayElement') continue
    const text = nodeText(n)
    const style = (n.attrs?.elementType as string) || 'action'
    children.push(
      new Paragraph({
        children: [new TextRun({ text, font: 'Courier New', size: 24 })],
        style,
      }),
    )
  }
  const file = new Document({ sections: [{ children }] })
  return Buffer.from(await Packer.toBuffer(file))
}
