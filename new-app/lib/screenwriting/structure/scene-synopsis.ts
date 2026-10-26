import type { JSONContent } from '@tiptap/core'

export function setSceneSynopsis(doc: JSONContent, sceneElementId: string, synopsis: string): JSONContent {
  const content = (doc.content ?? []).map((n) => {
    if (n.type !== 'screenplayElement') return n
    if (n.attrs?.id !== sceneElementId) return n
    if (n.attrs?.elementType !== 'sceneHeading') return n
    return { ...n, attrs: { ...n.attrs, synopsis } }
  })
  return { ...doc, content }
}
