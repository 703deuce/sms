/** TC4fix: autosave ordering after rapid undo (no false "already saved" sync). */
import { describe, expect, it } from 'vitest'
import {
  saveSyncRequired,
  shouldApplySaveResponse,
  wouldFalsePositiveSavedSync,
} from '@/lib/clips/editor-save-order'

describe('TC4fix save ordering', () => {
  it('requires sync while savedRevision trails localRevision', () => {
    expect(saveSyncRequired(0, 4)).toBe(true)
    expect(saveSyncRequired(4, 4)).toBe(false)
  })

  it('flags undo-back-to-saved false positive (must still PATCH)', () => {
    const json = '{"v":0}'
    expect(wouldFalsePositiveSavedSync(json, json, 0, 4)).toBe(true)
    expect(wouldFalsePositiveSavedSync(json, '{"v":1}', 0, 4)).toBe(false)
  })

  it('accepts only the latest save generation + revision on response', () => {
    expect(shouldApplySaveResponse(2, 2, 4, 4)).toBe(true)
    expect(shouldApplySaveResponse(1, 2, 4, 4)).toBe(false)
    expect(shouldApplySaveResponse(2, 2, 3, 4)).toBe(false)
  })
})
