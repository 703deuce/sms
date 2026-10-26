import type { JSONContent } from '@tiptap/core'
import type { ScreenplayElementType } from '@/lib/screenwriting/formats/types'
import type { LayoutElement, LayoutInlineBlock, LayoutSpeechColumn } from '@/lib/screenwriting/layout/types'

function nodeText(node: JSONContent): string {
  if (!node.content) return ''
  return node.content.map((c) => (c.type === 'text' ? c.text ?? '' : '')).join('')
}

function elementFromNode(node: JSONContent): LayoutElement {
  const id = (node.attrs?.id as string) || 'unknown'
  const elementType = (node.attrs?.elementType as ScreenplayElementType) || 'action'
  return {
    id,
    kind: elementType,
    elementType,
    text: nodeText(node),
  }
}

function columnFromNode(col: JSONContent): LayoutSpeechColumn {
  const blocks: LayoutInlineBlock[] = []
  let character = ''
  let characterId = ''
  for (const child of col.content ?? []) {
    if (child.type !== 'screenplayElement') continue
    const t = (child.attrs?.elementType as ScreenplayElementType) || 'dialogue'
    const text = nodeText(child)
    const id = (child.attrs?.id as string) || 'unknown'
    if (t === 'character') {
      character = text
      characterId = id
    } else if (t === 'parenthetical' || t === 'dialogue') {
      blocks.push({ kind: t, id, text })
    }
  }
  return { character, characterId, lines: blocks }
}

/** Flatten TipTap JSON into layout elements (pure). */
export function layoutElementsFromPmJson(doc: JSONContent): LayoutElement[] {
  const out: LayoutElement[] = []
  for (const node of doc.content ?? []) {
    if (node.type === 'pageBreak') {
      out.push({ id: `pb-${out.length}`, kind: 'pageBreak', text: '' })
      continue
    }
    if (node.type === 'dualDialogue') {
      const columns = (node.content ?? [])
        .filter((c) => c.type === 'dialogueColumn')
        .map(columnFromNode)
      out.push({
        id: (node.attrs?.id as string) || `dual-${out.length}`,
        kind: 'dualDialogue',
        text: '',
        columns,
      })
      continue
    }
    if (node.type === 'screenplayElement') {
      out.push(elementFromNode(node))
    }
  }
  return out
}
