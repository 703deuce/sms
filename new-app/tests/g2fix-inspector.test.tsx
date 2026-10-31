// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render } from '@testing-library/react'
import { AudioClipInspector } from '@/components/clips/editor/timeline/audio-clip-inspector'
import { defaultEdits, type ClipEditsV2 } from '@/lib/clips/edits'

afterEach(cleanup)

const edits = (): ClipEditsV2 => ({
  ...defaultEdits({ clipStartMs: 0, clipEndMs: 30_000 }),
  audio: {
    music: { generationId: 'm', uploadId: 'm', volume: 0.25, duckDepth: 0.7 },
    sfx: [
      { generationId: 'song2', uploadId: 'song2', atMs: 2000, volume: 0.25, durMs: 12_000, fadeInMs: 500, fadeOutMs: 1000, duckDepth: 0.7, kind: 'music' },
      { generationId: 'pop', atMs: 0, volume: 0.8 },
    ],
  },
})

describe('G2fix audio clip inspector', () => {
  it('a song on Music 2 gets the full music panel (Loop, Fit to length, BPM), no costs', () => {
    const onCommit = vi.fn()
    const { getByTestId, container } = render(
      <AudioClipInspector edits={edits()} lane="sfx" id="song2" kind="music" lenMs={12_000} durationMs={30_000} mediaMs={12_000} bpm={136} onCommit={onCommit} />,
    )
    expect(getByTestId('audio-clip-inspector').dataset.kind).toBe('music')
    expect(container.textContent).toContain('Music')
    expect(getByTestId('audio-clip-bpm').textContent).toContain('136')
    expect((getByTestId('audio-clip-duck') as HTMLInputElement).checked).toBe(true)
    fireEvent.click(getByTestId('audio-clip-fit'))
    expect((onCommit.mock.calls[0]![0] as ClipEditsV2).audio!.sfx[0]).toMatchObject({ atMs: 0, durMs: 30_000, loop: true, fadeOutMs: 2000 })
    fireEvent.click(getByTestId('audio-clip-loop'))
    expect((onCommit.mock.calls[1]![0] as ClipEditsV2).audio!.sfx[0]).toMatchObject({ loop: true, durMs: 12_000 })
    expect(container.textContent ?? '').not.toMatch(/\$|credit/i)
  })

  it('a plain SFX: no Loop / Fit, ducking off by default, fade max = half the clip', () => {
    const { getByTestId, queryByTestId, container } = render(
      <AudioClipInspector edits={edits()} lane="sfx" id="pop" kind="sfx" lenMs={1000} durationMs={30_000} onCommit={vi.fn()} />,
    )
    expect(queryByTestId('audio-clip-fit')).toBeNull()
    expect(queryByTestId('audio-clip-loop')).toBeNull()
    expect((getByTestId('audio-clip-duck') as HTMLInputElement).checked).toBe(false)
    expect(queryByTestId('audio-clip-duck-depth')).toBeNull()
    expect(getByTestId('audio-clip-fade-in').getAttribute('max')).toBe('0.5')
    expect(container.textContent).toContain('SFX')
  })
})
