// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { BeatCutControls } from '@/components/clips/editor/beat-cut-controls'
import { defaultEdits, normalizeEdits } from '@/lib/clips/edits'
import {
  applyBeatCutToEdits,
  beatCutWouldChangeEdits,
  resolveVideoLaneSegmentForBeatCut,
} from '@/lib/clips/editor/beat-autocut'
import { timebaseFor } from '@/lib/clips/editor/clip-timeline'
import { filterBeatsForCut } from '@/lib/clips/editor/strong-beats'

const bounds = { clipStartMs: 0, clipEndMs: 20_000 }

describe('Q6-fix2 cut to beat', () => {
  it('playhead 0 resolves the first video lane segment (>= start)', () => {
    const vsegs = [{ a: 0, b: 10_000, startMs: 0 }]
    const seg = resolveVideoLaneSegmentForBeatCut(vsegs, 0, null)
    expect(seg).toEqual({ startMs: 0, endMs: 10_000, srcIn: 0, srcOut: 10_000 })
  })

  it('legacy playhead-at-0 miss (>) would not find segment', () => {
    const vsegs = [{ a: 0, b: 10_000, startMs: 0 }]
    const legacy = vsegs.find((v) => 0 > v.startMs && 0 < v.startMs + (v.b - v.a))
    expect(legacy).toBeUndefined()
  })

  it('no-op beat cut does not change canonical edits', () => {
    const edits = normalizeEdits(defaultEdits(bounds), bounds)
    const tb = timebaseFor(edits)
    const beats = [500, 1500, 2500, 3500]
    const { next, changed } = applyBeatCutToEdits({
      edits,
      tb,
      cutBeatsMs: beats,
      every: 4,
      playheadMs: 0,
      brollItems: [],
      videoSegment: { startMs: 0, endMs: 500, srcIn: 0, srcOut: 500 },
      cutVideo: true,
    })
    expect(changed).toBe(false)
    expect(beatCutWouldChangeEdits(edits, next)).toBe(false)
  })

  it('beat cut adds splits when grid hits the segment', () => {
    const edits = normalizeEdits(defaultEdits(bounds), bounds)
    const tb = timebaseFor(edits)
    const beats = [1000, 2000, 3000, 4000, 5000]
    const { next, changed, cutCount } = applyBeatCutToEdits({
      edits,
      tb,
      cutBeatsMs: beats,
      every: 1,
      playheadMs: 0,
      brollItems: [],
      videoSegment: { startMs: 0, endMs: 8000, srcIn: 0, srcOut: 8000 },
      cutVideo: true,
    })
    expect(changed).toBe(true)
    expect(cutCount).toBeGreaterThan(0)
    expect((next.videoSplits ?? []).length).toBeGreaterThan(0)
  })

  it('strong filter uses music-file ms onset indices', () => {
    const beats = [0, 500, 1000, 1500, 2000, 2500]
    const onset = new Float32Array(300)
    for (let i = 0; i < onset.length; i++) onset[i] = i % 4 === 0 ? 1 : 0.1
    const strong = filterBeatsForCut(beats, 'strong', onset, 44_100)
    const all = filterBeatsForCut(beats, 'all', onset, 44_100)
    expect(strong.length).toBeLessThan(all.length)
  })

  it('BeatCutControls: button uses dropdown spacing', () => {
    const onCut = vi.fn()
    render(<BeatCutControls disabled={false} onCut={onCut} beatCount={12} bpm={120} />)
    fireEvent.change(screen.getByTestId('audio-beat-cut-select'), { target: { value: '4' } })
    fireEvent.click(screen.getByTestId('audio-beat-cut-run'))
    expect(onCut).toHaveBeenCalledWith(4)
  })

  it('BeatCutControls: renders beat count and BPM', () => {
    render(<BeatCutControls disabled={false} onCut={() => {}} beatCount={8} bpm={118.5} strength="strong" />)
    const status = screen.getByTestId('audio-beat-cut-status')
    expect(status.textContent).toMatch(/118 BPM/)
    expect(status.textContent).toMatch(/8 beats \(strong\)/)
  })

  it('BeatCutControls: analyzing state', () => {
    render(<BeatCutControls disabled onCut={() => {}} analyzing beatCount={0} />)
    expect(screen.getByTestId('audio-beat-cut-status').textContent).toMatch(/Analyzing beats/)
  })
})
