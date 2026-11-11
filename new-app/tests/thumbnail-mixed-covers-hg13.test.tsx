// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { ThumbnailPanel } from '@/components/clips/editor/thumbnail-panel'
import { defaultEdits } from '@/lib/clips/edits'

const fetchMock = vi.fn(async () => ({
  items: [
    { id: 'ok1', generationId: 'g1', aspect: '9:16', titleText: 'First', picked: false, status: 'READY', downloadUrl: '/cover1.jpg' },
    { id: 'bad', generationId: 'g2', aspect: '9:16', titleText: 'Second', picked: false, status: 'FAILED', error: 'Provider render failed', downloadUrl: null },
    { id: 'ok2', generationId: 'g3', aspect: '16:9', titleText: 'Third', picked: true, status: 'READY', downloadUrl: '/cover3.jpg' },
  ],
  jobs: [{ id: 'j', status: 'DONE' }],
}))
vi.mock('@/lib/clips-api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/clips-api')>()),
  clipsFetch: (...args: unknown[]) => fetchMock(...args),
}))
vi.mock('@/components/clips/editor/free-frame-thumbnail-picker', () => ({ FreeFrameThumbnailPicker: () => null }))
afterEach(() => { cleanup(); vi.clearAllMocks() })

describe('HG13 mixed cover result rendering', () => {
  it('keeps the two successful images while showing the failed image reason and honest action', async () => {
    render(<ThumbnailPanel clipId="fixture" edits={defaultEdits({ clipStartMs: 0, clipEndMs: 12000 })} onEdits={vi.fn()} />)
    await waitFor(() => expect(screen.getAllByTestId('cover-img')).toHaveLength(2))
    expect(screen.getByRole('alert').textContent).toContain('Cover failed')
    expect(screen.getByText('Provider render failed')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Generate 3 new covers' })).toBeTruthy()
    expect(screen.getAllByRole('button', { name: 'Set as cover' })).toHaveLength(3)
    expect(screen.getAllByRole('button', { name: 'Set as cover' }).filter((b) => (b as HTMLButtonElement).disabled)).toHaveLength(1)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
