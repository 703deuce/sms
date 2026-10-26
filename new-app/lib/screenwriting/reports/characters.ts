import type { JSONContent } from '@tiptap/core'

export interface CharacterReportRow {
  name: string
  scenes: number
  lines: number
  words: number
}

export function characterReport(doc: JSONContent): CharacterReportRow[] {
  const stats = new Map<string, CharacterReportRow>()
  let current = ''
  let inScene = false
  for (const n of doc.content ?? []) {
    if (n.type !== 'screenplayElement') continue
    const t = n.attrs?.elementType as string
    const text = (n.content ?? []).map((c) => (c.type === 'text' ? c.text ?? '' : '')).join('')
    if (t === 'sceneHeading') inScene = true
    if (t === 'character') current = text.trim().toUpperCase()
    if (t === 'dialogue' && current) {
      const row = stats.get(current) ?? { name: current, scenes: 0, lines: 0, words: 0 }
      row.lines++
      row.words += (text.match(/\b\w+\b/g) ?? []).length
      if (inScene) {
        row.scenes++
        inScene = false
      }
      stats.set(current, row)
    }
  }
  return [...stats.values()].sort((a, b) => a.name.localeCompare(b.name))
}
