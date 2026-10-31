import { describe, expect, it } from 'vitest'
import { EDITOR_RAIL_ITEMS, clipEditorRailIds } from '@/components/clips/editor/editor-rail'
import { TAB_META } from '@/components/clips/editor/editor-tab-meta'

const LAUNCH = ['transcript', 'cleanup', 'layout', 'layers', 'captions', 'audio']
// E4: appended after every existing item so nothing moves; E5 appends Media after them.
const E4 = ['text', 'templates', 'color', 'media']
// G1a: Properties inspector appended last.
const G1A = ['inspector']

describe('clip editor rail', () => {
  it('keeps the launch items first and in place, then appends re-hooked tools', () => {
    expect(EDITOR_RAIL_ITEMS.map((i) => i.id)).toEqual([...LAUNCH, 'broll', 'brand', 'thumbnail', ...E4, ...G1A])
  })

  it('shows Dub only with AI extras on', () => {
    expect(clipEditorRailIds(false)).not.toContain('dub')
    expect(clipEditorRailIds(true)).toEqual([...LAUNCH, 'broll', 'brand', 'thumbnail', 'dub', ...E4, ...G1A])
  })

  it('never puts AI Producer on the rail', () => {
    expect(clipEditorRailIds(true)).not.toContain('producer')
  })

  it('every rail item has a header label', () => {
    for (const id of clipEditorRailIds(true)) expect(TAB_META[id]?.label).toBeTruthy()
  })
})
