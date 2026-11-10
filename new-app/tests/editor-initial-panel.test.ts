// @ts-expect-error root tsc does not resolve the new-app vitest install
import { describe, expect, it } from 'vitest'
import { EDITOR_DEFAULT_PANEL, editorPanelFromSearchParam } from '../lib/clips/editor-initial-panel'

describe('editor initial panel from ?tab=', () => {
  it('defaults to transcript when the param is absent or unknown', () => {
    expect(EDITOR_DEFAULT_PANEL).toBe('transcript')
    expect(editorPanelFromSearchParam(undefined)).toBe('transcript')
    expect(editorPanelFromSearchParam(null)).toBe('transcript')
    expect(editorPanelFromSearchParam('')).toBe('transcript')
    expect(editorPanelFromSearchParam('not-a-panel')).toBe('transcript')
  })

  it('selects the Captions tab when tab=captions', () => {
    expect(editorPanelFromSearchParam('captions')).toBe('captions')
  })
})
