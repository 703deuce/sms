// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import { defaultEdits, normalizeEdits, type ClipEditsV2 } from '@/lib/clips/edits'
import { CleanupPanel } from '@/components/clips/editor/cleanup-panel'
import { TextPanel } from '@/components/clips/editor/text-panel'
import { AudioPanel } from '@/components/clips/editor/audio-panel'
import { SpeechSearchSection } from '@/components/clips/editor/speech-search-section'
import { Timeline } from '@/components/clips/editor/timeline'
import { clipsFetch } from '@/lib/clips-api'

vi.mock('@/lib/clips-api', () => ({
  clipsFetch: vi.fn((url: string) => {
    if (String(url).includes('stock-audio/search')) {
      return Promise.resolve({ available: true, hits: [] })
    }
    return Promise.resolve({})
  }),
  retranscribeProject: vi.fn(() => Promise.resolve({ ok: true, jobId: 'job1', status: 'QUEUED' })),
}))

vi.mock('sonner', () => ({
  toast: { message: vi.fn(), success: vi.fn(), error: vi.fn() },
}))

const bounds = { clipStartMs: 0, clipEndMs: 20_000, trimMinMs: 0, trimMaxMs: 40_000 }
const words = [{ i: 0, w: 'hello', s: 1, e: 1.4 }]

describe('B2 editor tools mount (no AI_EXTRAS flag)', () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('Cleanup panel shows Remove retakes and Edit for clarity', () => {
    const edits = normalizeEdits(defaultEdits(bounds), bounds)
    const { getByTestId } = render(
      <CleanupPanel
        clipId="clip1"
        projectId="proj1"
        bounds={bounds}
        edits={edits}
        words={words}
        gapSettings={{ mode: 'more_than', minGapSec: 0.6, maxGapSec: 3, targetGapSec: 0.35 }}
        onApplyProposal={vi.fn()}
        onRestoreProposal={vi.fn()}
        onCommitTrim={vi.fn()}
        onAuditionChange={vi.fn()}
        onSeek={vi.fn()}
      />,
    )
    expect(getByTestId('cleanup-ai-tools')).toBeTruthy()
    expect(getByTestId('retake-run').textContent).toMatch(/Remove retakes/)
    expect(getByTestId('clarity-run').textContent).toMatch(/Edit for clarity/)
  })

  it('Edit for clarity opens review when API returns proposals', async () => {
    vi.mocked(clipsFetch).mockResolvedValueOnce({
      proposals: [{ startMs: 1000, endMs: 2000, reason: 'tighten' }],
    })
    const onApplyPass = vi.fn()
    const edits = normalizeEdits(defaultEdits(bounds), bounds)
    const { getByTestId, findByText } = render(
      <CleanupPanel
        clipId="clip1"
        projectId="proj1"
        bounds={bounds}
        edits={edits}
        words={words}
        gapSettings={{ mode: 'more_than', minGapSec: 0.6, maxGapSec: 3, targetGapSec: 0.35 }}
        onApplyProposal={vi.fn()}
        onApplyPass={onApplyPass}
        onRestoreProposal={vi.fn()}
        onCommitTrim={vi.fn()}
        onAuditionChange={vi.fn()}
        onSeek={vi.fn()}
      />,
    )
    fireEvent.click(getByTestId('clarity-run'))
    await waitFor(() => expect(clipsFetch).toHaveBeenCalledWith('/api/clips/clips/clip1/clarity', expect.any(Object)))
    fireEvent.click(await findByText('Apply all clarity'))
    expect(onApplyPass).toHaveBeenCalledTimes(1)
  })

  it('Text panel voiceover preview calls voiceover API', async () => {
    const blob = new Blob(['x'], { type: 'audio/mpeg' })
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve({
          ok: true,
          blob: () => Promise.resolve(blob),
        }),
      ),
    )
    const edits = normalizeEdits(
      {
        ...defaultEdits(bounds),
        textItems: [
          {
            id: 't1',
            text: 'Hello world',
            startMs: 500,
            endMs: 3000,
            x: 50,
            y: 50,
            style: { font: 'Montserrat', size: 48, color: '#FFFFFF', align: 'center' as const },
          },
        ],
      },
      bounds,
    )
    const { getByTestId } = render(
      <TextPanel
        edits={edits}
        onEdits={vi.fn()}
        playheadMs={1000}
        durationMs={20_000}
        selectedId="t1"
        onSelect={vi.fn()}
        clipId="clip1"
        uploadLibraryFiles={vi.fn(async () => [{ refId: 'up1', ref: 'upload', id: 'm1', label: 'x', mediaType: 'audio' }])}
        placeVoiceover={vi.fn()}
      />,
    )
    fireEvent.click(getByTestId('text-voiceover-preview'))
    await waitFor(() => expect(fetch).toHaveBeenCalledWith('/api/clips/clips/clip1/voiceover', expect.any(Object)))
    vi.unstubAllGlobals()
  })

  it('Audio panel mounts standalone AI voiceover TTS', () => {
    const { getByTestId } = render(
      <AudioPanel
        clipId="clip1"
        edits={defaultEdits({ clipStartMs: 0, clipEndMs: 10_000 })}
        outputDurationMs={10_000}
        playheadMs={1200}
        onSuggestMusic={() => {}}
        onAttachMusic={() => {}}
        onPatchMusic={() => {}}
        onRemoveMusic={() => {}}
        onAddSfx={() => {}}
        onUpdateSfx={() => {}}
        onRemoveSfx={() => {}}
        onPatchStudioSound={() => {}}
        uploadLibraryFiles={async () => [{ refId: 'u1', mediaType: 'audio', filename: 'a.mp3' }]}
        addVoiceover={() => {}}
      />,
    )
    expect(getByTestId('audio-panel-ai-voiceover')).toBeTruthy()
    expect(getByTestId('text-voiceover-input')).toBeTruthy()
  })

  it('Audio panel mounts voiceover for selected text item', () => {
    const edits = normalizeEdits(defaultEdits(bounds), bounds)
    const { getByTestId } = render(
      <AudioPanel
        clipId="clip1"
        edits={edits}
        outputDurationMs={20_000}
        playheadMs={1000}
        onSuggestMusic={vi.fn()}
        onAttachMusic={vi.fn()}
        onPatchMusic={vi.fn()}
        onRemoveMusic={vi.fn()}
        onAddSfx={vi.fn()}
        onUpdateSfx={vi.fn()}
        onRemoveSfx={vi.fn()}
        onPatchStudioSound={vi.fn()}
        textVoiceover={{ text: 'Narration line', atMs: 800 }}
        uploadLibraryFiles={vi.fn(async () => [])}
        addVoiceover={vi.fn()}
      />,
    )
    expect(getByTestId('audio-panel-voiceover')).toBeTruthy()
    expect(getByTestId('text-voiceover-preview')).toBeTruthy()
  })

  it('timeline context menu Generate voiceover opens Text flow', () => {
    const e: ClipEditsV2 = {
      ...normalizeEdits(defaultEdits(bounds), bounds),
      textItems: [
        {
          id: 't1',
          text: 'On screen',
          startMs: 1000,
          endMs: 4000,
          x: 50,
          y: 40,
          style: { font: 'Montserrat', size: 48, color: '#FFFFFF', align: 'center' as const },
        },
      ],
    }
    const onOpenTextVoiceover = vi.fn()
    const { getAllByTestId } = render(
      <Timeline
        edits={e}
        words={words}
        shots={[]}
        outputMs={2000}
        clipOutputDurationMs={20_000}
        onSeekOutput={vi.fn()}
        clipStartMs={bounds.clipStartMs}
        clipEndMs={bounds.clipEndMs}
        trimMinMs={bounds.trimMinMs}
        trimMaxMs={bounds.trimMaxMs}
        onCommitEdits={vi.fn()}
        onOpenTextVoiceover={onOpenTextVoiceover}
      />,
    )
    const item = getAllByTestId('timeline-item-text').find((el) => el.getAttribute('data-item-id') === 't1')!
    act(() => {
      fireEvent.pointerDown(item, { button: 0, clientX: 100, pointerId: 1 })
    })
    act(() => {
      fireEvent.pointerUp(window, { clientX: 100, pointerId: 1 })
    })
    fireEvent.contextMenu(item, { clientX: 80, clientY: 80 })
    fireEvent.click(document.querySelector('[data-testid="timeline-ctx-voiceover"]')!)
    expect(onOpenTextVoiceover).toHaveBeenCalledWith('t1')
  })

  it('speech search shows No matches for empty hits', async () => {
    vi.mocked(clipsFetch).mockResolvedValueOnce({ hits: [], untranscribed: 0 })
    const edits = normalizeEdits(defaultEdits(bounds), bounds)
    const { getByTestId, findByTestId } = render(
      <SpeechSearchSection
        projectId="proj1"
        edits={edits}
        media={{ items: [], transcripts: [], uploadFiles: vi.fn(), refresh: vi.fn() }}
        playheadSourceMs={0}
        onSeekSource={vi.fn()}
        onEdits={vi.fn()}
      />,
    )
    fireEvent.change(getByTestId('speech-search-input'), { target: { value: 'nothing here' } })
    expect((await findByTestId('speech-search-no-matches')).textContent).toMatch(/No matches/)
  })
})
