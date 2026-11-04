import { describe, expect, it } from 'vitest'
import { clipEditorRailIds, EDITOR_RAIL_GROUPS } from '@/components/clips/editor/editor-rail'
import { clipEditorRailGroupIds, editorRailGroups } from '@/lib/clips/editor/editor-rail-navigation'
import { TAB_META } from '@/components/clips/editor/editor-tab-meta'

describe('clip editor rail', () => {
  it('exposes seven rail groups with expected tabs (Phase 2)', () => {
    expect(clipEditorRailGroupIds()).toEqual([
      'captions',
      'text',
      'media',
      'audio',
      'effects',
      'layers',
      'templates',
    ])
    const media = editorRailGroups(false).find((g) => g.id === 'media')
    expect(media?.tabs.map((t) => t.id)).toEqual(['media', 'broll', 'thumbnail'])
    const effects = editorRailGroups(false).find((g) => g.id === 'effects')
    expect(effects?.tabs.map((t) => t.id)).toEqual(['cleanup', 'color', 'layout'])
  })

  it('left panels include repurpose but not producer or inspector', () => {
    expect(clipEditorRailIds(false)).toContain('repurpose')
    expect(clipEditorRailIds(false)).not.toContain('producer')
    expect(clipEditorRailIds(false)).not.toContain('inspector')
  })

  it('shows Dub tab under Audio only with AI extras on', () => {
    const audioOff = editorRailGroups(false).find((g) => g.id === 'audio')
    expect(audioOff?.tabs.map((t) => t.id)).toEqual(['audio'])
    const audioOn = editorRailGroups(true).find((g) => g.id === 'audio')
    expect(audioOn?.tabs.map((t) => t.id)).toEqual(['audio', 'dub'])
  })

  it('every left-panel id has a header label', () => {
    for (const id of clipEditorRailIds(true)) expect(TAB_META[id]?.label).toBeTruthy()
  })

  it('EDITOR_RAIL_GROUPS mirrors navigation groups', () => {
    expect(EDITOR_RAIL_GROUPS.length).toBe(7)
  })
})
