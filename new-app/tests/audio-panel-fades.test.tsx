// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render } from '@testing-library/react'
import { AudioPanel } from '@/components/clips/editor/audio-panel'
import { defaultEdits } from '@/lib/clips/edits'

// This suite checks the fade controls, not the unrelated stock catalog network.
// Prevent its mount-time search from calling a non-running localhost server in CI.
vi.mock('@/components/clips/editor/stock-audio-picker', () => ({ StockAudioPicker: () => null }))

afterEach(cleanup)

describe('Audio panel fade controls (E11)', () => {
  it('persists Music and SFX fade times in the existing edits model', () => {
    const onPatchMusic = vi.fn()
    const onUpdateSfx = vi.fn()
    const edits = defaultEdits({ clipStartMs: 0, clipEndMs: 60_000 })
    edits.audio = {
      music: { generationId: 'music1', fadeInMs: 500, fadeOutMs: 1000 },
      sfx: [{ generationId: 'sfx1', atMs: 3000, fadeInMs: 0, fadeOutMs: 0 }],
    }
    const ui = render(
      <AudioPanel
        clipId="clip1"
        edits={edits}
        outputDurationMs={60_000}
        playheadMs={3000}
        onSuggestMusic={vi.fn()}
        onAttachMusic={vi.fn()}
        onPatchMusic={onPatchMusic}
        onRemoveMusic={vi.fn()}
        onAddSfx={vi.fn()}
        onUpdateSfx={onUpdateSfx}
        onRemoveSfx={vi.fn()}
        onPatchStudioSound={vi.fn()}
      />,
    )
    expect(ui.getByTestId('music-fade-controls')).toBeTruthy()
    expect(ui.getByTestId('sfx-fade-controls')).toBeTruthy()
    const musicIn = ui.getByLabelText('Music fade in seconds') as HTMLInputElement
    fireEvent.change(musicIn, { target: { value: '2.5' } })
    fireEvent.blur(musicIn)
    expect(onPatchMusic).toHaveBeenCalledWith({ fadeInMs: 2500 })
    const sfxOut = ui.getByLabelText('SFX fade out seconds') as HTMLInputElement
    fireEvent.change(sfxOut, { target: { value: '1.2' } })
    fireEvent.blur(sfxOut)
    expect(onUpdateSfx).toHaveBeenCalledWith('sfx1', { fadeOutMs: 1200 })
  })
})
