import type { JSONContent } from '@tiptap/core'

export interface WritingStats {
  words: number
  pages: number
  scenes: number
}

export function computeWritingStats(doc: JSONContent, pageCount: number): WritingStats {
  const text = JSON.stringify(doc)
  const words = (text.match(/\b\w+\b/g) ?? []).length
  const scenes = (doc.content ?? []).filter(
    (n) => n.type === 'screenplayElement' && n.attrs?.elementType === 'sceneHeading',
  ).length
  return { words, pages: pageCount, scenes }
}

export function goalProgress(words: number, goal: number): number {
  if (goal <= 0) return 0
  return Math.min(100, Math.round((words / goal) * 100))
}
