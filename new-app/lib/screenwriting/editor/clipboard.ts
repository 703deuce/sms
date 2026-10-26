import type { JSONContent } from '@tiptap/core'

/** Parse plain text paste into screenplay element blocks (one line = one action). */
export function pastePlainTextToElements(text: string): JSONContent[] {
  return text
    .split(/\n/)
    .map((line, i) => ({
      type: 'screenplayElement',
      attrs: { id: `paste_${i}`, elementType: 'action' },
      content: line ? [{ type: 'text', text: line }] : [],
    }))
}
