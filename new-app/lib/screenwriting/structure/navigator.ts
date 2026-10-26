import type { JSONContent } from '@tiptap/core'

export interface NavigatorRow {
  id: string
  ord: number
  heading: string
  page?: string
  synopsis?: string
}

export function scenesFromPmJson(doc: JSONContent): NavigatorRow[] {
  const rows: NavigatorRow[] = []
  let ord = 0
  for (const n of doc.content ?? []) {
    if (n.type !== 'screenplayElement') continue
    if (n.attrs?.elementType !== 'sceneHeading') continue
    const text = (n.content ?? []).map((c) => (c.type === 'text' ? c.text ?? '' : '')).join('')
    rows.push({
      id: (n.attrs?.id as string) || `sc-${ord}`,
      ord,
      heading: text,
      synopsis: (n.attrs?.synopsis as string) || undefined,
    })
    ord++
  }
  return rows
}

export function navigatorToCsv(rows: NavigatorRow[]): string {
  const header = 'ord,heading,synopsis'
  const lines = rows.map((r) => `${r.ord},"${r.heading.replace(/"/g, '""')}","${(r.synopsis ?? '').replace(/"/g, '""')}"`)
  return [header, ...lines].join('\n')
}
