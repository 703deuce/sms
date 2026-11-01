// @vitest-environment happy-dom
/**
 * G4cfix: CORS on every preview consumer (filmstrip still, audio graph guard), blur preview geometry,
 * colour / effect keyframe rows (no stale static value), fast / ranged scene scan and the B-roll /
 * insert scene splits.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render } from '@testing-library/react'
afterEach(cleanup)
import { useState } from 'react'
import { defaultEdits, normalizeEdits, type ClipEditsV2 } from '@/lib/clips/edits'
import { videoContentRect } from '@/components/clips/editor/g4/layer-fx-preview'
import { audioGraphSafe } from '@/components/clips/editor/g4/media-cors'
import { TimelineFilmstrip } from '@/components/clips/editor/timeline/timeline-filmstrip'
import { KeyframeInspector, dropEmptyColorTrack } from '@/components/clips/editor/timeline/keyframe-inspector'
import { videoGradeAt } from '@/lib/clips/editor/grade-runtime'
import { clipRanges, sampleTimes, SCENE_FAST_MAX, SCENE_FAST_STEP_MS } from '@/lib/clips/editor/scene-detect'
import { splitBrollAtMedia, splitInsertAtMedia } from '@/lib/clips/editor/scene-items'
import { MainVideoTools } from '@/components/clips/editor/g4/video-tools'
import { FX_PROPS } from '@/lib/clips/editor/motion-schema'

const bounds = { clipStartMs: 0, clipEndMs: 20000, trimMinMs: 0, trimMaxMs: 40000 }
const base = () => normalizeEdits(defaultEdits(bounds), bounds)

describe('G4cfix CORS', () => {
  it('filmstrip still is a CORS <img>, not a CSS background', () => {
    const { container } = render(
      <TimelineFilmstrip fromMs={0} toMs={4000} widthPx={200} heightPx={40} pxPerMs={0.05} stillUrl="https://b2.example.com/poster.jpg?X-Amz-Signature=1" />,
    )
    const img = container.querySelector('[data-testid="timeline-filmstrip-still"]') as HTMLImageElement
    expect(img).toBeTruthy()
    expect(img.getAttribute('crossorigin')).toBe('anonymous')
    const tile = container.querySelector('[data-testid="timeline-filmstrip-tile"]') as HTMLElement
    expect(tile.style.backgroundImage).toBe('')
  })
  it('audio graph only for same-origin or CORS-mode media', () => {
    const v = document.createElement('video')
    v.setAttribute('src', '/local.mp4')
    expect(audioGraphSafe(v)).toBe(true)
    v.setAttribute('src', 'https://b2.example.com/source.mp4')
    expect(audioGraphSafe(v)).toBe(false)
    v.crossOrigin = 'anonymous'
    expect(audioGraphSafe(v)).toBe(true)
    v.dataset.g4corsOff = 'https://b2.example.com/source.mp4'
    expect(audioGraphSafe(v)).toBe(false)
  })
})

describe('G4cfix blur preview geometry', () => {
  it('maps object-fit cover / contain / fill like the stage video', () => {
    const box = { left: 0, top: 0, width: 100, height: 200 }
    expect(videoContentRect(box, 1920, 1080, 'fill')).toEqual({ x: 0, y: 0, w: 100, h: 200 })
    const c = videoContentRect(box, 1920, 1080, 'contain')
    expect(c.w).toBeCloseTo(100)
    expect(c.y).toBeCloseTo((200 - 56.25) / 2)
    const cv = videoContentRect(box, 1920, 1080, 'cover')
    expect(cv.h).toBeCloseTo(200)
    expect(cv.x).toBeCloseTo((100 - 355.555) / 2, 1)
  })
})

function Fx({ spec, onEdits }: { spec: ClipEditsV2['color']; onEdits: (e: ClipEditsV2) => void }) {
  const [edits, setEdits] = useState<ClipEditsV2>({ ...base(), color: spec })
  return (
    <KeyframeInspector
      edits={edits}
      target="video"
      label="Effects"
      localMs={1000}
      props={FX_PROPS}
      baseValue={(p) => (p === 'fxGlow' ? Number(edits.color?.fx?.glow ?? 0) : 0)}
      onCommit={(n) => {
        setEdits(n)
        onEdits(n)
      }}
      onSeekLocal={() => {}}
    />
  )
}

describe('G4cfix effect keyframe rows', () => {
  it('a row without keyframes shows the slider value; ◇ keys it; removing the last key drops the track', () => {
    let last: ClipEditsV2 | null = null
    const { getByTestId } = render(<Fx spec={{ fx: { glow: 40 } } as ClipEditsV2['color']} onEdits={(e) => (last = e)} />)
    expect((getByTestId('kf-value-fxGlow') as HTMLInputElement).value).toBe('40')
    fireEvent.click(getByTestId('kf-toggle-fxGlow'))
    const tr = last!.keyframes!.find((k) => k.prop === 'fxGlow')!
    expect(tr.points).toEqual([expect.objectContaining({ tMs: 1000, v: 40 })])
    fireEvent.click(getByTestId('kf-toggle-fxGlow'))
    expect(last!.keyframes!.some((k) => k.prop === 'fxGlow')).toBe(false)
    expect((getByTestId('kf-value-fxGlow') as HTMLInputElement).value).toBe('40')
  })
  it('typing on an un-keyed row starts a keyframe (never a hidden static override)', () => {
    let last: ClipEditsV2 | null = null
    const { getByTestId } = render(<Fx spec={undefined} onEdits={(e) => (last = e)} />)
    const box = getByTestId('kf-value-fxGlow') as HTMLInputElement
    fireEvent.change(box, { target: { value: '80' } })
    fireEvent.blur(box)
    const tr = last!.keyframes!.find((k) => k.prop === 'fxGlow')!
    expect(tr.points.length).toBe(1)
    expect(videoGradeAt(last!, 1000, 1000)?.fx?.glow).toBe(80)
  })
  it('keyframed glow ramps the preview spec', () => {
    const e: ClipEditsV2 = { ...base(), keyframes: [{ target: 'video', prop: 'fxGlow', points: [{ tMs: 0, v: 0 }, { tMs: 2000, v: 80 }] }] } as ClipEditsV2
    expect(videoGradeAt(e, 0, 0)?.fx?.glow ?? 0).toBe(0)
    expect(videoGradeAt(e, 1000, 1000)?.fx?.glow).toBe(40)
    expect(videoGradeAt(e, 2000, 2000)?.fx?.glow).toBe(80)
  })
  it('dropEmptyColorTrack keeps motion tracks', () => {
    const e = { ...base(), keyframes: [{ target: 'video', prop: 'x', value: 10, points: [] }] } as unknown as ClipEditsV2
    expect(dropEmptyColorTrack(e, 'video', 'x' as never)).toBe(e)
  })
})

describe('G4cfix scene scan', () => {
  it('a 12-min clip is ≤ SCENE_FAST_MAX samples; ranges clip to the selected item', () => {
    const t = sampleTimes([[0, 720_000]], SCENE_FAST_STEP_MS, SCENE_FAST_MAX)
    expect(t.length).toBeLessThanOrEqual(SCENE_FAST_MAX)
    expect(clipRanges([[0, 5000], [8000, 20000]], 3000, 10000)).toEqual([[3000, 5000], [8000, 10000]])
  })
  it('scope buttons appear for a selected Video item', () => {
    const { getByTestId } = render(
      <MainVideoTools edits={base()} videoItem={{ srcInMs: 0, srcOutMs: 5000 }} outputMs={0} durationMs={20000} onCommit={() => {}} onSeekOutput={() => {}} />,
    )
    expect(getByTestId('scene-split-scope-item').getAttribute('aria-checked')).toBe('true')
    fireEvent.click(getByTestId('scene-split-scope-all'))
    expect(getByTestId('scene-split-scope-all').getAttribute('aria-checked')).toBe('true')
  })
  it('splits a B-roll item at media cuts', () => {
    const e = { ...base(), broll: [{ id: 'b1', source: 'upload', uploadId: 'u', startMs: 1000, endMs: 9000, inMs: 2000 }] } as unknown as ClipEditsV2
    const n = splitBrollAtMedia(e, 'b1', [5000, 8000])
    expect(n.broll!.map((b) => [b.startMs, b.endMs, b.inMs ?? 0])).toEqual([
      [1000, 4000, 2000],
      [4000, 7000, 5000],
      [7000, 9000, 8000],
    ])
    expect(new Set(n.broll!.map((b) => b.id)).size).toBe(3)
  })
  it('splits an insert into consecutive inserts with the same anchor', () => {
    const e = { ...base(), inserts: [{ id: 'i1', sourceId: 's', atSrcMs: 3000, inMs: 1000, durMs: 6000 }] } as unknown as ClipEditsV2
    const n = splitInsertAtMedia(e, 'i1', [4000])
    expect(n.inserts!.map((x) => [x.atSrcMs, x.inMs, x.durMs])).toEqual([
      [3000, 1000, 3000],
      [3000, 4000, 3000],
    ])
  })
})
