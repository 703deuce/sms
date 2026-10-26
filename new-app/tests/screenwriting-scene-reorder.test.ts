import { describe, expect, it } from 'vitest'
import { reorderScenesInDoc } from '@/lib/screenwriting/structure/scene-reorder'

describe('scene reorder', () => {
  it('moves second scene before first', () => {
    const doc = {
      type: 'doc',
      content: [
        { type: 'screenplayElement', attrs: { id: 'a', elementType: 'sceneHeading' }, content: [{ type: 'text', text: 'INT. A' }] },
        { type: 'screenplayElement', attrs: { id: 'b', elementType: 'action' }, content: [{ type: 'text', text: 'One' }] },
        { type: 'screenplayElement', attrs: { id: 'c', elementType: 'sceneHeading' }, content: [{ type: 'text', text: 'INT. B' }] },
        { type: 'screenplayElement', attrs: { id: 'd', elementType: 'action' }, content: [{ type: 'text', text: 'Two' }] },
      ],
    }
    const next = reorderScenesInDoc(doc, 1, 0)
    expect((next.content?.[0] as { content?: { text?: string }[] }).content?.[0]?.text).toBe('INT. B')
  })
})
