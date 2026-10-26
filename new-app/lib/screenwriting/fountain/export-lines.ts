import type { JSONContent } from '@tiptap/core'
import type { ScreenplayElementType } from '@/lib/screenwriting/formats/types'

function nodeText(node: JSONContent): string {
  if (!node.content) return ''
  return node.content.map((c) => (c.type === 'text' ? c.text ?? '' : '')).join('')
}

const CLUSTER: ScreenplayElementType[] = ['character', 'parenthetical', 'dialogue']

function isCluster(t: ScreenplayElementType): boolean {
  return CLUSTER.includes(t)
}

/** Fountain export without spurious blank lines inside dialogue blocks. */
export function pmJsonToFountainLines(doc: JSONContent): string {
  const lines: string[] = []
  let prev: ScreenplayElementType | null = null

  for (const node of doc.content ?? []) {
    if (node.type !== 'screenplayElement') continue
    const t = (node.attrs?.elementType as ScreenplayElementType) || 'action'
    const text = nodeText(node)
    if (!text && t === 'action') continue

    const needGap = prev !== null && !(isCluster(prev) && isCluster(t)) && t !== 'parenthetical'
    if (needGap && lines.length && lines[lines.length - 1] !== '') {
      lines.push('')
    }

    switch (t) {
      case 'sceneHeading':
        lines.push(text.toUpperCase())
        lines.push('')
        break
      case 'character':
        lines.push(text.toUpperCase())
        break
      case 'parenthetical':
        lines.push(text.startsWith('(') ? text : `(${text})`)
        break
      case 'dialogue':
        lines.push(text)
        break
      case 'transition':
        lines.push(`> ${text}`)
        lines.push('')
        break
      default:
        lines.push(text)
        if (!isCluster(t)) lines.push('')
    }
    prev = t
  }
  return lines.join('\n').trimEnd() + '\n'
}
