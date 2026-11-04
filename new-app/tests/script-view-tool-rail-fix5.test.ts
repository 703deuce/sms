import { describe, expect, it } from 'vitest'
import { SCRIPT_VIEW_TOOL_PANELS } from '@/components/clips/editor/script-view-tool-rail'

describe('LAYOUT_FIX5 script tool rail', () => {
  it('lists Clean up and Layout first', () => {
    expect(SCRIPT_VIEW_TOOL_PANELS[0]?.id).toBe('cleanup')
    expect(SCRIPT_VIEW_TOOL_PANELS[1]?.id).toBe('layout')
  })
})
