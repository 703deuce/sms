/** TC4fix / TC4fix2: autosave ordering + pagehide newest revision. */
import { describe, expect, it } from 'vitest'
import {
  nextClientSaveSeq,
  nextStoredClientSaveSeq,
  saveSyncRequired,
  shouldApplySaveResponse,
  shouldDiscardDraftForServerStamp,
  shouldRejectStaleClientSave,
  shouldSendPagehideKeepalive,
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

describe('TC4fix2 pagehide + draft', () => {
  it('always keepalives when local revision is ahead of last ack', () => {
    expect(shouldSendPagehideKeepalive(2, 5)).toBe(true)
    expect(shouldSendPagehideKeepalive(5, 5)).toBe(false)
  })

  it('keeps draft when server stamp moved but draft carries a local revision', () => {
    expect(
      shouldDiscardDraftForServerStamp('2026-01-01T00:00:00Z', '2026-01-02T00:00:00Z', 3, true),
    ).toBe(false)
    expect(
      shouldDiscardDraftForServerStamp('2026-01-01T00:00:00Z', '2026-01-02T00:00:00Z', 0, true),
    ).toBe(true)
  })

  it('rejects stale client save seq on the server', () => {
    expect(shouldRejectStaleClientSave(2, 5)).toBe(true)
    expect(shouldRejectStaleClientSave(6, 5)).toBe(false)
    expect(nextStoredClientSaveSeq(6, 5)).toBe(6)
  })

  it('TC4fix3 client save seq is monotonic across fresh sessions', () => {
    expect(nextClientSaveSeq(0)).toBeGreaterThan(1e12)
  })
})
