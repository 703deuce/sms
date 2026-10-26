import { nanoid } from 'nanoid'

export function newElementId(): string {
  return nanoid(12)
}

export function emptyScreenplayDoc() {
  return {
    type: 'doc',
    content: [
      {
        type: 'screenplayElement',
        attrs: { id: newElementId(), elementType: 'action' },
        content: [{ type: 'text', text: '' }],
      },
    ],
  }
}
