// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render } from '@testing-library/react'
import { AudioClipInspector } from '@/components/clips/editor/timeline/audio-clip-inspector'
import { TimelineLaneHeader } from '@/components/clips/editor/timeline/timeline-lane-header'
import { defaultEdits, type ClipEditsV2 } from '@/lib/clips/edits'

afterEach(cleanup)

const edits = (): ClipEditsV2 => ({
  ...defaultEdits({ clipStartMs: 0, clipEndMs: 30_000 }),
  audio: {
    music: { generationId: 'm', uploadId: 'm', volume: 0.25, duckDepth: 0.7, fadeInMs: 500, fadeOutMs: 1000, startMs: 3000, endMs: 9000 },
    sfx: [{ generationId: 's', atMs: 0, volume: 0.8 }],
  },
})

describe('G2 audio clip inspector', () => {
  it('music: Fit to length is one click (start 0, loop a short song, 2 s fade); no costs shown', () => {
    const onCommit = vi.fn()
    const { getByTestId, container } = render(
      <AudioClipInspector edits={edits()} lane="music" id="m" durationMs={30_000} mediaMs={12_000} bpm={120} onCommit={onCommit} />,
    )
    fireEvent.click(getByTestId('audio-clip-fit'))
    const next = onCommit.mock.calls[0]![0] as ClipEditsV2
    expect(next.audio?.music).toMatchObject({ startMs: 0, inMs: 0, loop: true, fadeOutMs: 2000 })
    expect(getByTestId('audio-clip-bpm').textContent).toContain('120')
    expect(container.textContent ?? '').not.toMatch(/\$|credit/i)
  })

  it('clip: fades and ducking are manual settings on the clip', () => {
    const onCommit = vi.fn()
    const { getByTestId, queryByTestId } = render(
      <AudioClipInspector edits={edits()} lane="sfx" id="s" durationMs={30_000} onCommit={onCommit} />,
    )
    expect(queryByTestId('audio-clip-fit')).toBeNull()
    fireEvent.change(getByTestId('audio-clip-fade-in'), { target: { value: '1.5' } })
    expect((onCommit.mock.calls[0]![0] as ClipEditsV2).audio?.sfx[0]?.fadeInMs).toBe(1500)
    fireEvent.click(getByTestId('audio-clip-duck'))
    expect((onCommit.mock.calls[1]![0] as ClipEditsV2).audio?.sfx[0]?.duckDepth).toBe(0.7)
  })
})

describe('G2 solo button', () => {
  it('audio lanes and audio tracks have S; visual lanes do not', () => {
    const onToggle = vi.fn()
    const { getByTestId } = render(<TimelineLaneHeader lane="music" state={{}} height={22} onToggle={onToggle} />)
    fireEvent.click(getByTestId('timeline-lane-solo-music'))
    expect(onToggle).toHaveBeenCalledWith({ soloed: true })
    cleanup()
    const r2 = render(<TimelineLaneHeader lane="sfx" state={{ soloed: true }} height={20} testKey="sfx-au2" onToggle={onToggle} />)
    expect(r2.getByTestId('timeline-lane-solo-sfx-au2').getAttribute('aria-pressed')).toBe('true')
    cleanup()
    const r3 = render(<TimelineLaneHeader lane="broll" state={{}} height={30} onToggle={onToggle} />)
    expect(r3.queryByTestId('timeline-lane-solo-broll')).toBeNull()
  })
})
