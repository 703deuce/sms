import { describe, expect, it } from 'vitest'
import { buildEditorDockTabEntries } from '@/lib/clips/editor/editor-dock-tabs'
import { editorRailGroups } from '@/lib/clips/editor/editor-rail-navigation'

describe('editor dock tab strip', () => {
  it('includes Properties as the 8th tab in fit calculation', () => {
    const groups = editorRailGroups(false).length
    expect(groups).toBe(7)
    const entries = buildEditorDockTabEntries({ includeProperties: true })
    expect(entries).toHaveLength(8)
    expect(entries[entries.length - 1]?.kind).toBe('properties')
  })

  it('Script leading tab adds to entry list', () => {
    const entries = buildEditorDockTabEntries({
      leading: [{ panelId: 'transcript', label: 'Script', icon: editorRailGroups()[0]!.icon }],
      includeProperties: true,
    })
    expect(entries[0]?.kind).toBe('leading')
    expect(entries).toHaveLength(9)
  })
})
