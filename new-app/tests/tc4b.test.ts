/** TC4b: cross-track fade cleanup, save on leave, reorder drop. */
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { defaultEdits, normalizeEdits, type ClipEditsV2 } from '@/lib/clips/edits'
import { moveItems } from '@/lib/clips/editor/clip-timeline'
import { autoCrossfade } from '@/lib/clips/editor/auto-crossfade'
import { addTrack } from '@/lib/clips/editor/tracks'
import type { BrollItem } from '@/lib/clips/broll'

const bounds = { clipStartMs: 0, clipEndMs: 20000, trimMinMs: 0, trimMaxMs: 40000 }
const br = (id: string, a: number, b: number): BrollItem => ({ id, source: 'stock', assetId: id, startMs: a, endMs: b, inMs: 0 })
const ctx = (e: ClipEditsV2) => ({ edits: e, previewEdits: e })
const src = (f: string) => readFileSync(join(process.cwd(), f), 'utf8')

describe('TC4b', () => {
  it('(1) dragging cross-track clips apart removes the fade — with ⇅ Tracks on or off', () => {
    let e: ClipEditsV2 = { ...normalizeEdits(defaultEdits(bounds), bounds), broll: [br('a', 0, 3000), br('b', 4000, 6000)] }
    const added = addTrack(e, 'overlay')!
    e = { ...added.edits, tracks: added.edits.tracks!.map((t) => (t.id === added.trackId ? { ...t, items: ['b'] } : t)) }
    const ref = [{ lane: 'broll' as const, id: 'b' }]
    const m = moveItems(ctx(e), ref, -1500)!
    const x = autoCrossfade(e, m, e, m, ref, undefined, true)
    expect(x.keyframes?.length).toBe(1)
    for (const on of [true, false]) {
      const back = moveItems(ctx(x), ref, 1500)!
      expect(autoCrossfade(x, back, x, back, ref, undefined, on).keyframes).toBeUndefined()
    }
  })
  it('(2) unsaved edits are flushed on pagehide / beforeunload (draft + keepalive PATCH)', () => {
    const s = src('components/clips/editor/use-editor-state.ts')
    expect(s).toContain("window.addEventListener('pagehide', onLeave)")
    expect(s).toContain("window.addEventListener('beforeunload', onLeave)")
    expect(s).toMatch(/keepalive: true/)
    expect(s).toMatch(/clientSaveSeq: leaveSeq/)
    expect(s).not.toMatch(/if \(inFlight\) return/)
  })
  it('(3) reorder drag blocks native image drag and ends on pointercancel', () => {
    const s = src('components/clips/editor/timeline.tsx')
    const i = s.indexOf('const startVideoReorder')
    expect(s.slice(i, i + 400)).toContain('e.preventDefault()')
    expect(s.slice(i, i + 2500)).toContain("window.addEventListener('pointercancel', onUp)")
  })
})
