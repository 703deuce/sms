// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import { StockAudioPicker } from '@/components/clips/editor/stock-audio-picker'
import { clipsFetch } from '@/lib/clips-api'
import { toast } from 'sonner'

vi.mock('@/lib/clips-api', () => ({ clipsFetch: vi.fn() }))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), loading: vi.fn(), dismiss: vi.fn() } }))
afterEach(() => { cleanup(); vi.clearAllMocks() })

describe('N3 CC0 stock sound placement', () => {
  it('attaches at the current playhead and confirms the SFX lane and time', async () => {
    vi.mocked(clipsFetch).mockImplementation(async (url) => {
      if (String(url).includes('/stock-audio/search')) return {
        available: true, hits: [{ id: 'kenney-pop', title: 'Pop', kind: 'sfx', license: 'cc0',
          durationS: 1, tags: [], previewUrl: 'https://example.com/pop.mp3' }],
      } as never
      if (String(url).includes('/stock-audio/attach')) return { uploadId: 'uploaded-pop' } as never
      throw new Error('Unexpected audio API')
    })
    const onSfxUploaded = vi.fn()
    const ui = render(<StockAudioPicker clipId="clip-1" kind="sfx" playheadMs={12_000}
      hasMusicBed={false} onGeneratePreset={vi.fn()} onMusicUploaded={vi.fn()}
      onSfxUploaded={onSfxUploaded} />)
    await waitFor(() => expect(ui.getByTestId('stock-audio-add')).toBeTruthy())
    fireEvent.click(ui.getByTestId('stock-audio-add'))
    expect(toast.loading).toHaveBeenCalledWith('Adding Pop…', { id: 'stock-audio-attach' })
    await waitFor(() => expect(onSfxUploaded).toHaveBeenCalledWith('uploaded-pop', 12_000))
    expect(toast.dismiss).toHaveBeenCalledWith('stock-audio-attach')
    expect(toast.success).toHaveBeenCalledWith('Added to SFX at 0:12', { description: 'Pop' })
  })
})
