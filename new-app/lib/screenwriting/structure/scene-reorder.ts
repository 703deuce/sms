import type { JSONContent } from '@tiptap/core'

/** Move a scene block (heading through next heading) to a new ordinal among scene headings. */
export function reorderScenesInDoc(doc: JSONContent, fromOrd: number, toOrd: number): JSONContent {
  const blocks = [...(doc.content ?? [])]
  const sceneStarts: number[] = []
  blocks.forEach((n, i) => {
    if (n.type === 'screenplayElement' && n.attrs?.elementType === 'sceneHeading') sceneStarts.push(i)
  })
  if (fromOrd < 0 || fromOrd >= sceneStarts.length || toOrd < 0 || toOrd >= sceneStarts.length) return doc

  const start = sceneStarts[fromOrd]
  const end = fromOrd + 1 < sceneStarts.length ? sceneStarts[fromOrd + 1] : blocks.length
  const slice = blocks.splice(start, end - start)
  const reindexed = [...blocks]
  const sceneStarts2: number[] = []
  reindexed.forEach((n, i) => {
    if (n.type === 'screenplayElement' && n.attrs?.elementType === 'sceneHeading') sceneStarts2.push(i)
  })
  const insertAt = sceneStarts2[toOrd] ?? reindexed.length
  reindexed.splice(insertAt, 0, ...slice)
  return { ...doc, content: reindexed }
}
