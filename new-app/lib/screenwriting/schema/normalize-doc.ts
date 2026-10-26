import type { JSONContent } from '@tiptap/core'
import { emptyScreenplayDoc } from '@/lib/screenwriting/schema/empty-doc'
import { newElementId } from '@/lib/screenwriting/schema/empty-doc'

/** Ensure TipTap doc is a screenplay (block elements), not an empty or foreign schema. */
export function normalizeScreenplayDoc(input: JSONContent | null | undefined): JSONContent {
  const doc = input?.type === 'doc' ? input : { type: 'doc', content: [] }
  const content = doc.content ?? []
  const hasScreenplay = content.some(
    (n) => n.type === 'screenplayElement' || n.type === 'dualDialogue' || n.type === 'pageBreak',
  )
  if (!hasScreenplay) {
    if (content.length === 0) return emptyScreenplayDoc() as JSONContent
    const migrated: JSONContent[] = []
    for (const n of content) {
      if (n.type === 'paragraph' || n.type === 'heading') {
        const text = (n.content ?? []).map((c) => (c.type === 'text' ? c.text ?? '' : '')).join('')
        migrated.push({
          type: 'screenplayElement',
          attrs: { id: newElementId(), elementType: 'action' },
          content: text ? [{ type: 'text', text }] : [],
        })
      }
    }
    if (migrated.length) return { type: 'doc', content: migrated }
    return emptyScreenplayDoc() as JSONContent
  }
  return doc as JSONContent
}
