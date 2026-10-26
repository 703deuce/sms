import { describe, expect, it } from 'vitest'
import { autoDetectElementType, nextElementType } from '@/lib/screenwriting/editor/element-keys'
import { DEFAULT_SMARTTYPE, learnToken, rankSuggestions, renameCharacterInLists } from '@/lib/screenwriting/smarttype/store'

describe('element key map', () => {
  it('Enter from scene heading goes to action', () => {
    expect(nextElementType('sceneHeading', 'enter')).toBe('action')
  })

  it('Tab from action goes to character', () => {
    expect(nextElementType('action', 'tab')).toBe('character')
  })

  it('backspace on empty dialogue returns character', () => {
    expect(nextElementType('dialogue', 'backspaceEmpty')).toBe('character')
  })
})

describe('auto-detect', () => {
  it('detects INT. scene heading', () => {
    expect(autoDetectElementType('INT. HOUSE - DAY', 'action')).toBe('sceneHeading')
  })

  it('parenthetical from dialogue paren', () => {
    expect(autoDetectElementType('(quietly)', 'dialogue')).toBe('parenthetical')
  })
})

describe('SmartType', () => {
  it('learns and dedupes', () => {
    expect(learnToken(['BOB'], 'bob')).toEqual(['bob'])
  })

  it('ranks prefix matches first', () => {
    const list = rankSuggestions(['INT.', 'INTERCUT'], 'in')
    expect(list[0]).toBe('INT.')
  })

  it('rename character updates list', () => {
    const next = renameCharacterInLists({ ...DEFAULT_SMARTTYPE, characters: ['JACK'] }, 'JACK', 'JOHN')
    expect(next.characters).toContain('JOHN')
    expect(next.characters).not.toContain('JACK')
  })
})
