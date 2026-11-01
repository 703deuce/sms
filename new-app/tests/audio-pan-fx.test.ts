import { describe, expect, it, vi } from 'vitest'
import { normalizeAudioEdits, panGains } from '@/lib/clips/audio'
import { defaultEdits, normalizeEdits, type ClipEditsV2 } from '@/lib/clips/edits'
import { patchAudioClip } from '@/lib/clips/editor/audio-clip'
import { coalescePush, type CoalesceBurst } from '@/lib/clips/editor/undo-coalesce'
import { buildFxChain, webAudioPlan, type TrackFx } from '@/lib/clips/editor/track-fx'
import { sfxMixKey } from '@/components/clips/editor/use-audio-mix'

describe('audio pan + track FX (AU-11/12/31)', () => {
  it('panGains balance law', () => {
    expect(panGains(0)).toEqual([1, 1])
    expect(panGains(-100)).toEqual([1, 0])
    expect(panGains(50)).toEqual([0.5, 1])
  })

  it('normalizeAudioEdits keeps pan, drops zero / junk', () => {
    const a = normalizeAudioEdits({
      music: null,
      sfx: [
        { generationId: 's', atMs: 0, pan: 30 },
        { generationId: 'z', atMs: 1, pan: 0 },
        { generationId: 'q', atMs: 2, pan: 250 },
      ],
    })
    expect(a.sfx[0]?.pan).toBe(30)
    expect(a.sfx[1]?.pan).toBeUndefined()
    expect(a.sfx[2]?.pan).toBe(100)
    const old = normalizeAudioEdits({
      music: { generationId: 'm', volume: 0.25 },
      sfx: [{ generationId: 's', atMs: 0, volume: 0.8 }],
    })
    expect(normalizeAudioEdits(old)).toEqual(old)
  })

  it('webAudioPlan order: vfx before pre stop; pan last on voice only', () => {
    const fx: TrackFx = {
      track: 'voice',
      eq: { hp: 80, low: 1, mid: -2, high: 3 },
      comp: { threshold: -18, ratio: 3, attack: 10, release: 150, makeup: 0 },
      deess: 60,
      vfx: { type: 'echo', amount: 50 },
      lufs: -16,
      limit: -1,
      pan: 20,
    }
    const pre = webAudioPlan(fx, 2, 'pre')
    expect(pre.some((n) => n.type === 'delays')).toBe(true)
    expect(pre.some((n) => n.type === 'pan')).toBe(false)
    const all = webAudioPlan(fx, 2, 'all')
    expect(all.map((n) => n.type)).toEqual(['biquad', 'biquad', 'biquad', 'biquad', 'comp', 'gain', 'delays', 'gain', 'comp', 'gain', 'pan'])
    expect(webAudioPlan({ track: 'music', pan: 50 }, null, 'all').some((n) => n.type === 'pan')).toBe(false)
  })

  it('buildFxChain pan / ring starts oscillator', () => {
    const oscStart = vi.fn()
    const node = () => ({ connect: vi.fn(), gain: { value: 0 }, delayTime: { value: 0 }, type: '', frequency: { value: 0 }, Q: { value: 0 } })
    const ctx = {
      createBiquadFilter: node,
      createDynamicsCompressor: node,
      createGain: node,
      createDelay: node,
      createChannelSplitter: node,
      createChannelMerger: node,
      createOscillator: () => ({ type: 'sine', frequency: { value: 0 }, connect: vi.fn(), start: oscStart }),
    }
    buildFxChain(ctx as never, [{ type: 'pan', gl: 1, gr: 0.5 }])
    buildFxChain(ctx as never, [{ type: 'ring', hz: 60, m: 0.5 }])
    expect(oscStart).toHaveBeenCalled()
  })

  it('sfxMixKey includes pan', () => {
    const base = [{ generationId: 'a', atMs: 0, volume: 1 }]
    const k0 = sfxMixKey(base, '', '', false, 0)
    const k1 = sfxMixKey([{ ...base[0]!, pan: 40 }], '', '', false, 0)
    expect(k0).not.toBe(k1)
  })

  it('§8 #1: coalesced fade edits = one undo step', () => {
    const bounds = { clipStartMs: 0, clipEndMs: 10_000 }
    let edits = normalizeEdits(defaultEdits(bounds), bounds)
    edits = {
      ...edits,
      audio: { music: null, sfx: [{ generationId: 's', atMs: 0, volume: 0.8, fadeInMs: 0 }] },
    }
    const history: ClipEditsV2[] = [edits]
    let burst: CoalesceBurst | null = null
    const commit = (patch: { fadeInMs: number }) => {
      const before = edits.audio?.sfx[0]?.fadeInMs ?? 0
      const next = patchAudioClip(edits, 'sfx', 's', patch)
      if (!next) return
      const now = Date.now()
      const k = 'sfx:s:fadeInMs'
      const push = coalescePush(burst, k, now, String(before))
      if (push) history.push(next)
      else history[history.length - 1] = next
      edits = next
      burst = { key: k, at: now, sig: String(next.audio?.sfx[0]?.fadeInMs ?? 0) }
    }
    commit({ fadeInMs: 200 })
    commit({ fadeInMs: 400 })
    commit({ fadeInMs: 600 })
    expect(history).toHaveLength(2)
    expect(history[1]!.audio?.sfx[0]?.fadeInMs).toBe(600)
  })
})
