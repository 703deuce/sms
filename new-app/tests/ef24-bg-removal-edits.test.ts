import { describe, expect, it } from 'vitest'
import { defaultEdits, editsPayloadForSave, isDefaultEdits, normalizeEdits } from '@/lib/clips/edits'
import { bgRemovalBlockedReason, refineAlpha } from '@/lib/clips/editor/bg-removal'

const bounds = { clipStartMs: 0, clipEndMs: 60_000, trimMinMs: 0, trimMaxMs: 60_000 }

describe('EF-24 bgRemoval edits', () => {
  it('normalizes clamps and round-trips', () => {
    const out = normalizeEdits(
      {
        bgRemoval: {
          enabled: true,
          quality: 'x',
          refine: { feather: 999, choke: -500 },
          background: { type: 'color', color: '#ABCDEF', junk: 1 },
        },
      },
      bounds,
    )
    expect(out.bgRemoval).toEqual({
      enabled: true,
      quality: 'standard',
      refine: { feather: 100, choke: -100 },
      background: { type: 'color', color: 'abcdef' },
    })
  })

  it('editsPayloadForSave clears absent bgRemoval', () => {
    const edits = defaultEdits(bounds)
    expect(editsPayloadForSave(edits).bgRemoval).toBeNull()
  })

  it('isDefaultEdits respects enabled flag', () => {
    const on = normalizeEdits({ bgRemoval: { enabled: true, background: { type: 'blur', amount: 50 } } }, bounds)
    const off = normalizeEdits({ bgRemoval: { enabled: false, background: { type: 'blur', amount: 50 } } }, bounds)
    expect(isDefaultEdits(on, bounds)).toBe(false)
    expect(isDefaultEdits(off, bounds)).toBe(true)
  })

  it('bgRemovalBlockedReason gates layouts and stabilize', () => {
    expect(bgRemovalBlockedReason(normalizeEdits({ layout: { mode: 'stack', shotOverrides: [] } }, bounds))).toBeTruthy()
    expect(bgRemovalBlockedReason(normalizeEdits({ stabilize: [{ startMs: 0, endMs: 1000 }] }, bounds))).toBeTruthy()
    expect(
      bgRemovalBlockedReason(normalizeEdits({ sourceSegments: [{ id: 's', sourceId: 'a', startMs: 0, endMs: 1000 }] }, bounds)),
    ).toBeTruthy()
  })

  it('E2 enables full-frame, fill and segmented speaker layouts without breaking per-clip compatibility', () => {
    const full = normalizeEdits({ layout: { mode: 'full_frame', shotOverrides: [] } }, bounds)
    const fill = normalizeEdits({ layout: { mode: 'fill', shotOverrides: [] } }, bounds)
    const follow = normalizeEdits({
      layout: {
        mode: 'speaker_follow', shotOverrides: [],
        layoutSegments: [{ startMs: 0, endMs: 30000, mode: 'full_frame' }, { startMs: 30000, endMs: 60000, mode: 'speaker_follow' }],
      },
    }, bounds)
    expect(bgRemovalBlockedReason(full)).toBeNull()
    expect(bgRemovalBlockedReason(fill)).toBeNull()
    expect(bgRemovalBlockedReason(follow)).toBeNull()
    expect(bgRemovalBlockedReason(normalizeEdits({ layout: { mode: 'facecam_pip', shotOverrides: [] } }, bounds))).toBeTruthy()
  })

  it('refineAlpha parity points', () => {
    expect(refineAlpha(0.5, 0, 0)).toBe(0.5)
    expect(refineAlpha(0.3, 0, 40)).toBeCloseTo(0.125, 10)
  })
})
