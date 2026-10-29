import { describe, expect, it } from 'vitest'
import { EDITOR_RAIL_ITEMS } from '@/components/clips/editor/editor-rail'

describe('clip editor rail', () => {
  it('shows transcript, cleanup, polish, captions, and audio', () => {
    expect(EDITOR_RAIL_ITEMS.map((i) => i.id)).toEqual([
      'transcript',
      'cleanup',
      'layout',
      'layers',
      'captions',
      'audio',
    ])
  })
})
