// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { applyMotionFrame, type MotionDom } from '@/components/clips/editor/motion-preview'
import { defaultEdits, normalizeEdits, type ClipEditsV2 } from '@/lib/clips/edits'
import { timebaseFor } from '@/lib/clips/editor/clip-timeline'

const bounds = { clipStartMs: 0, clipEndMs: 20000 }

function dom(): MotionDom {
  const mk = () => document.createElement('div')
  const mainLayer = mk()
  const v = document.createElement('video')
  v.setAttribute('src', 'https://example.test/v.mp4')
  v.setAttribute('data-testid', 'main-video')
  v.style.transform = 'translate3d(-10px,0,0)'
  mainLayer.appendChild(v)
  return {
    under: mk(), mainKf: mk(), mainLayer, cloneA: mk(), cutDip: mk(), cloneB: mk(),
    brollBox: { b1: mk() }, brollDip: { b1: mk() }, hook: mk(),
  }
}

describe('motion-preview DOM controller', () => {
  const e: ClipEditsV2 = {
    ...normalizeEdits(defaultEdits(bounds), bounds),
    cutRanges: [[3000, 4000]],
    transitions: [{ srcMs: 4000, type: 'dip_white', durMs: 400 }],
    keyframes: [{ target: 'video', prop: 'rotation', value: 10, points: [] }],
    broll: [{ id: 'b1', source: 'stock', assetId: 'a', startMs: 6000, endMs: 9000, transitionOut: { type: 'wipe_left', durMs: 400 } }],
  }
  const tb = timebaseFor(e)
  const opts = { boxW: 360, playing: false, rate: 1, mediaOffsetMs: 0 }

  it('inside a cut window: main hidden, both clones shown at the handle times, dip colour set', () => {
    const d = dom()
    applyMotionFrame(d, e, tb, 3050, opts)
    expect(d.mainKf!.style.transform).toContain('rotate(10deg)')
    expect(d.mainLayer!.style.visibility).toBe('hidden')
    const ca = d.cloneA!.querySelector('video')!
    const cb = d.cloneB!.querySelector('video')!
    expect(ca.getAttribute('data-testid')).toBeNull()
    expect(ca.muted).toBe(true)
    expect(ca.currentTime).toBeCloseTo(3.05, 2) // aEnd 3000 + 50
    expect(cb.currentTime).toBeCloseTo(4.05, 2) // bStart 4000 + 50
    expect(ca.style.transform).toBe('translate3d(-10px,0,0)') // crop transform mirrored
    expect(d.cutDip!.style.background).toMatch(/#fff|rgb\(255, 255, 255\)/)
    expect(Number(d.cutDip!.style.opacity)).toBeGreaterThan(0.5)
    applyMotionFrame(d, e, tb, 5000, opts)
    expect(d.mainLayer!.style.visibility).toBe('')
    expect(d.cloneA!.style.visibility).toBe('hidden')
  })

  it('B-roll out window clips the item (wipe) and hides it after its end', () => {
    const d = dom()
    applyMotionFrame(d, e, tb, 8800, opts)
    expect(d.brollBox.b1!.style.visibility).toBe('visible')
    expect(d.brollBox.b1!.style.clipPath).toMatch(/^inset\(/)
    applyMotionFrame(d, e, tb, 9100, opts)
    expect(d.brollBox.b1!.style.visibility).toBe('hidden')
  })
})
