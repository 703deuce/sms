import { describe, expect, it } from 'vitest'
import { isScriptEditorEnabledFromEnv } from '@/lib/features/script-editor-enabled'

describe('isScriptEditorEnabledFromEnv', () => {
  it('default off', () => {
    expect(isScriptEditorEnabledFromEnv({})).toBe(false)
  })

  it('enables on NEXT_PUBLIC_SCRIPT_EDITOR_ENABLED', () => {
    expect(isScriptEditorEnabledFromEnv({ NEXT_PUBLIC_SCRIPT_EDITOR_ENABLED: 'true' })).toBe(true)
  })

  it('enables on SCRIPT_EDITOR_ENABLED server env', () => {
    expect(isScriptEditorEnabledFromEnv({ SCRIPT_EDITOR_ENABLED: '1' })).toBe(true)
  })
})
