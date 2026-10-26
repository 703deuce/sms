import type { JSONContent } from '@tiptap/core'

export const DEFAULT_BREAKDOWN_KEYS = [
  'cast',
  'props',
  'wardrobe',
  'vehicles',
  'sfx',
  'vfx',
] as const

export interface BreakdownTag {
  itemId: string
  categoryKey: string
  name: string
  elementId: string
  textSpan?: { from: number; to: number }
}

export function extractTagsFromDoc(doc: JSONContent): BreakdownTag[] {
  const tags: BreakdownTag[] = []
  for (const n of doc.content ?? []) {
    if (n.type !== 'screenplayElement') continue
    const marks = (n.content ?? []).flatMap((c) => (c.marks as { type: string; attrs?: Record<string, string> }[]) ?? [])
    for (const m of marks) {
      if (m.type === 'tag' && m.attrs?.itemId) {
        tags.push({
          itemId: m.attrs.itemId,
          categoryKey: m.attrs.categoryKey || 'misc',
          name: m.attrs.name || 'Item',
          elementId: (n.attrs?.id as string) || '',
        })
      }
    }
  }
  return tags
}
