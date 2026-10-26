import type { JSONContent } from '@tiptap/core'

export function appendPmJson(base: JSONContent, imported: JSONContent): JSONContent {
  const a = base.content ?? []
  const b = imported.content ?? []
  if (!a.length) return { type: 'doc', content: [...b] }
  if (!b.length) return base
  return { type: 'doc', content: [...a, ...b] }
}
