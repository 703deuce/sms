import { describe, expect, it } from 'vitest'
import { EDITOR_RAIL_ITEMS, clipEditorRailIds } from '@/components/clips/editor/editor-rail'
import { TAB_META } from '@/components/clips/editor/editor-tab-meta'

const LAUNCH = ['transcript', 'cleanup', 'layout', 'layers', 'captions', 'audio']
// E4: appended after every existing item so nothing moves.
const E4 = ['text', 'templates', 'color']

describe('clip editor rail', () => {
  it('keeps the launch items first and in place, then appends re-hooked tools', () => {
    expect(EDITOR_RAIL_ITEMS.map((i) => i.id)).toEqual([...LAUNCH, 'broll', 'brand', 'thumbnail', ...E4])
  })

  it('shows Dub only with AI extras on', () => {
    expect(clipEditorRailIds(false)).not.toContain('dub')
    expect(clipEditorRailIds(true)).toEqual([...LAUNCH, 'broll', 'brand', 'thumbnail', 'dub', ...E4])
  })

  it('never puts AI Producer on the rail', () => {
    expect(clipEditorRailIds(true)).not.toContain('producer')
  })

  it('every rail item has a header label', () => {
    for (const id of clipEditorRailIds(true)) expect(TAB_META[id]?.label).toBeTruthy()
  })
})
