// @vitest-environment happy-dom
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { TextVoiceoverSection } from '@/components/clips/editor/text-voiceover-section'

describe('TextVoiceoverSection', () => {
  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it('place after preview calls TTS once and reuses preview blob', async () => {
    const blob = new Blob([new Uint8Array([1, 2, 3])], { type: 'audio/mpeg' })
    const fetch = vi.fn(async () => ({ ok: true, blob: async () => blob }))
    vi.stubGlobal('fetch', fetch)
    vi.stubGlobal(
      'Audio',
      class {
        duration = 1.6
        addEventListener(ev: string, fn: () => void) {
          if (ev === 'loadedmetadata') fn()
        }
        removeEventListener() {}
        play() {
          return Promise.resolve()
        }
      },
    )

    const uploadLibraryFiles = vi.fn(async () => [{ refId: 'upl_1' } as never])
    const placeVoiceover = vi.fn()

    const { getByTestId } = render(
      <TextVoiceoverSection
        clipId="clip1"
        text="Hello world"
        atMs={30_000}
        resolvePlaceAtMs={() => 30_000}
        uploadLibraryFiles={uploadLibraryFiles}
        placeVoiceover={placeVoiceover}
        standalone
      />,
    )

    fireEvent.click(getByTestId('text-voiceover-preview'))
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1))

    fireEvent.click(getByTestId('text-voiceover-place'))
    await waitFor(() => expect(placeVoiceover).toHaveBeenCalledWith('upl_1', 30_000, expect.any(Number)))
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(getByTestId('text-voiceover-place').textContent).toMatch(/Place on timeline/)
  })

  it('anchors placement at click-time playhead', async () => {
    const blob = new Blob([new Uint8Array([1])], { type: 'audio/mpeg' })
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, blob: async () => blob })))
    vi.stubGlobal(
      'Audio',
      class {
        duration = 2
        addEventListener(ev: string, fn: () => void) {
          if (ev === 'loadedmetadata') fn()
        }
        removeEventListener() {}
        play() {
          return Promise.resolve()
        }
      },
    )
    let playhead = 30_000
    const placeVoiceover = vi.fn()
    const uploadLibraryFiles = vi.fn(async () => [{ refId: 'upl_x' } as never])

    const { getByTestId } = render(
      <TextVoiceoverSection
        clipId="c"
        text="Hi"
        atMs={playhead}
        resolvePlaceAtMs={() => playhead}
        uploadLibraryFiles={uploadLibraryFiles}
        placeVoiceover={placeVoiceover}
      />,
    )

    fireEvent.click(getByTestId('text-voiceover-place'))
    playhead = 30_330
    await waitFor(() => expect(placeVoiceover).toHaveBeenCalledWith('upl_x', 30_000, expect.any(Number)))
  })
})
