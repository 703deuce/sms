import type { JSONContent } from '@tiptap/core'
import { newElementId } from '@/lib/screenwriting/schema/empty-doc'
import type { ScreenplayElementType } from '@/lib/screenwriting/formats/types'
import { parseFountain, type FountainBlock } from '@/lib/screenwriting/fountain/parse'
import { pmJsonToFountainLines } from '@/lib/screenwriting/fountain/export-lines'

function blockToNode(type: ScreenplayElementType, text: string): JSONContent {
  return {
    type: 'screenplayElement',
    attrs: { id: newElementId(), elementType: type },
    content: text ? [{ type: 'text', text }] : [],
  }
}

export function fountainToPmJson(source: string): JSONContent {
  const blocks = parseFountain(source)
  if (!blocks.length) {
    return blockToNode('action', '') as JSONContent & { type: 'doc' }
  }
  return {
    type: 'doc',
    content: blocks.map((b) => blockToNode(b.type, b.text)),
  }
}

function nodeText(node: JSONContent): string {
  if (!node.content) return ''
  return node.content.map((c) => (c.type === 'text' ? c.text ?? '' : '')).join('')
}

export function pmJsonToFountain(doc: JSONContent): string {
  return pmJsonToFountainLines(doc)
}

export function pmJsonToPlainTxt(doc: JSONContent): string {
  const lines: string[] = []
  for (const node of doc.content ?? []) {
    if (node.type !== 'screenplayElement') continue
    const text = nodeText(node)
    if (text) lines.push(text)
    else lines.push('')
  }
  return lines.join('\n').trimEnd() + '\n'
}

export function fountainBlocksForTest(source: string): FountainBlock[] {
  return parseFountain(source)
}
