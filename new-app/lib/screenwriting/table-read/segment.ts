import type { JSONContent } from '@tiptap/core'

export interface TableReadUtterance {
  elementId: string
  speaker: string
  text: string
  skip?: boolean
}

export function segmentTableRead(doc: JSONContent, castMap: Record<string, string>): TableReadUtterance[] {
  const out: TableReadUtterance[] = []
  let character = ''
  for (const n of doc.content ?? []) {
    if (n.type !== 'screenplayElement') continue
    const t = n.attrs?.elementType as string
    const id = (n.attrs?.id as string) || ''
    const text = (n.content ?? []).map((c) => (c.type === 'text' ? c.text ?? '' : '')).join('')
    if (t === 'character') character = text.trim().toUpperCase()
    if (t === 'parenthetical') continue
    if (t === 'dialogue' && character) {
      out.push({ elementId: id, speaker: castMap[character] || character, text })
    }
    if (t === 'action' && text.trim()) {
      out.push({ elementId: id, speaker: castMap.NARRATOR || 'NARRATOR', text })
    }
  }
  return out
}

export function estimateAudioMinutes(utterances: TableReadUtterance[], wpm = 150): number {
  const words = utterances.reduce((n, u) => n + (u.text.match(/\b\w+\b/g) ?? []).length, 0)
  return words / wpm
}
