// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { PreviewStage } from '@/components/clips/editor/preview-stage'
import { isCrossOriginUrl } from '@/components/clips/editor/g4/media-cors'
import { stageBoxForZoom } from '@/lib/clips/editor/preview-view'
import { normalizeEdits } from '@/lib/clips/edits'
import { setPropertyAt } from '@/lib/clips/editor/keyframes'
import { editorPosterUrl } from '@/lib/server/clips/editor-clip-media'

const bounds = { clipStartMs: 0, clipEndMs: 20000 }

// Every preview test mounts a player with async effects; unmount it before the next case.
afterEach(cleanup)

describe('PreviewStage E3 layers', () => {
  it('ED12 keeps the editor poster same-origin so it does not require bucket CORS', () => {
    const poster = editorPosterUrl('clip_1', 'ws/w/projects/p/clips/clip_1/poster.jpg')
    expect(poster).toBe('/api/clips/clips/clip_1/poster')
    expect(isCrossOriginUrl(poster!)).toBe(false)
  })

  it('F1 mutes the separate J/L-cut speech element when the Voice lane is muted', () => {
    const edits = normalizeEdits({
      v: 2, trim: { in: 0, out: 20_000 },
      cutRanges: [[9_000, 10_000]],
      splitEdits: [{ atMs: 10_000, audioMs: 300 }],
    }, bounds)
    const stage = render(<PreviewStage
      videoUrl="https://example.com/video.mp4"
      edits={edits}
      words={[]}
      cropTrack={null}
      videoRef={{ current: null }}
      onTick={vi.fn()}
      voiceOutputMuted={false}
    />)
    const extra = stage.getByTestId('preview-split-audio') as HTMLVideoElement
    expect(extra.muted).toBe(false)
    stage.rerender(<PreviewStage
      videoUrl="https://example.com/video.mp4"
      edits={edits}
      words={[]}
      cropTrack={null}
      videoRef={{ current: null }}
      onTick={vi.fn()}
      voiceOutputMuted
    />)
    expect(extra.muted).toBe(true)
  })


  it('renders the transition clones, sorted B-roll boxes and keeps the main video unique', () => {
    const edits = normalizeEdits(
      {
        v: 2,
        trim: { in: 0, out: 20000 },
        cutRanges: [[3000, 4000]],
        broll: [
          { id: 'b2', source: 'stock', assetId: 'a2', startMs: 9000, endMs: 11000, transitionIn: { type: 'crossfade', durMs: 400 } },
          { id: 'b1', source: 'stock', assetId: 'a1', startMs: 6000, endMs: 9000 },
        ],
        transitions: [{ srcMs: 4000, type: 'push_left', durMs: 400 }],
        keyframes: [{ target: 'video', prop: 'scale', points: [{ tMs: 0, v: 100 }, { tMs: 2000, v: 120 }] }],
      },
      bounds,
    )
    expect(edits.transitions).toHaveLength(1)
    const r = render(
      <PreviewStage
        videoUrl="https://example.com/video.mp4"
        edits={edits}
        words={[{ i: 0, w: 'hi', s: 0.5, e: 1 }]}
        cropTrack={null}
        brollMedia={[
          { id: 'b1', source: 'stock', startMs: 6000, endMs: 9000, url: 'https://example.com/b1.mp4' },
          { id: 'b2', source: 'stock', startMs: 9000, endMs: 11000, url: 'https://example.com/b2.mp4' },
        ]}
        videoRef={{ current: null }}
        onTick={vi.fn()}
      />,
    )
    expect(r.getByTestId('preview-transition-a')).toBeTruthy()
    expect(r.getByTestId('preview-transition-b')).toBeTruthy()
    expect(r.getByTestId('preview-transition-color')).toBeTruthy()
    expect(r.getAllByTestId('preview-broll-layer').map((el) => el.getAttribute('data-broll-id'))).toEqual(['b1', 'b2'])
    // Clones are created lazily during a window → only one main video element at rest.
    expect(r.getByTestId('preview-transition-a').querySelector('video')).toBeNull()
  })

  it('E4: Rotation 15 appears on the main Video transform immediately after Properties edits', () => {
    const before = normalizeEdits({ v: 2, trim: { in: 0, out: 20000 } }, bounds)
    const r = render(
      <PreviewStage videoUrl="https://example.com/video.mp4" edits={before}
        words={[]} cropTrack={null} videoRef={{ current: null }} onTick={vi.fn()} />,
    )
    const node = r.getByTestId('preview-main-kf')
    const after = setPropertyAt(before, 'video', 'rotation', 0, 15)
    r.rerender(
      <PreviewStage videoUrl="https://example.com/video.mp4" edits={after}
        words={[]} cropTrack={null} videoRef={{ current: null }} onTick={vi.fn()} />,
    )
    expect(node.getAttribute('style')).toContain('rotate(15deg)')
  })

  it('21:9 testBoxSize uses pillarbox path and zoom 200 scales stage', () => {
    const edits = normalizeEdits({ v: 2, trim: { in: 0, out: 5000 }, aspectRatio: '21:9' }, bounds)
    const fit = { w: 420, h: 180 }
    const at200 = stageBoxForZoom(fit, '21:9', 200, 1)
    const r = render(
      <PreviewStage
        videoUrl="https://example.com/video.mp4"
        edits={edits}
        words={[]}
        cropTrack={null}
        videoRef={{ current: null }}
        onTick={vi.fn()}
        testBoxSize={fit}
        previewZoom={200}
      />,
    )
    const stage = r.container.querySelector('[data-preview-zoom="200"]') as HTMLElement
    expect(stage).toBeTruthy()
    expect(stage.style.width).toBe(`${at200.w}px`)
    expect(stage.style.height).toBe(`${at200.h}px`)
  })
})
