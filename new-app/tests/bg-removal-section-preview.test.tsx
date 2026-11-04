// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import { BgRemovalSection } from '@/components/clips/editor/g4/bg-removal-section'
import { defaultEdits } from '@/lib/clips/edits'
import { BG_DEFAULT } from '@/lib/clips/editor/bg-removal'

afterEach(() => { cleanup(); vi.unstubAllGlobals() })

describe('E2 background removal UI and worker matte preview', () => {
  const bounds = { clipStartMs: 0, clipEndMs: 20_000 }
  it('can activate person removal for Full frame and preserves undoable edits', () => {
    const edits = { ...defaultEdits(bounds), layout: { ...defaultEdits(bounds).layout, mode: 'full_frame' as const } }
    const onCommit = vi.fn()
    const ui = render(<BgRemovalSection edits={edits} onCommit={onCommit} />)
    const button = ui.getByTestId('bg-remove-toggle') as HTMLButtonElement
    expect(button.disabled).toBe(false)
    fireEvent.click(button)
    expect(onCommit.mock.calls[0]?.[0].bgRemoval?.enabled).toBe(true)
  })

  it('shows only a real persisted person matte returned by the clip-scoped API', async () => {
    const edits = { ...defaultEdits(bounds), bgRemoval: { ...BG_DEFAULT, enabled: true } }
    const fetchSpy = vi.fn(async (rawUrl: string) => ({
      ok: true,
      json: async () => rawUrl.includes('/bg-matte')
        ? { data: { state: 'ready', url: 'https://example.test/generated-matte.mp4' } }
        : { data: { render: null } },
    }))
    vi.stubGlobal('fetch', fetchSpy)
    const ui = render(<BgRemovalSection clipId="clip-one" edits={edits} onCommit={vi.fn()} />)
    await waitFor(() => expect(ui.getByTestId('bg-matte-preview')).toBeTruthy())
    const video = ui.getByLabelText('Generated person matte preview') as HTMLVideoElement
    expect(video.getAttribute('src')).toBe('https://example.test/generated-matte.mp4')
    expect(ui.getByTestId('bg-removal-note').textContent).toContain('ready')
    expect(fetchSpy).toHaveBeenCalledWith('/api/clips/clips/clip-one/bg-matte', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ quality: 'standard' }),
    }))
  })

  it('E2 immediately queues a true preview and reports zero credits before the worker finishes', async () => {
    const edits = { ...defaultEdits(bounds), bgRemoval: { ...BG_DEFAULT, enabled: true } }
    const fetchSpy = vi.fn(async (rawUrl: string, opts?: { method?: string }) => ({
      ok: true,
      json: async () => rawUrl.includes('/bg-matte')
        ? opts?.method === 'POST' ? { data: { state: 'queued', url: null, credits: 0 } }
          : { data: { state: 'processing', url: null } }
        : { data: { render: null } },
    }))
    vi.stubGlobal('fetch', fetchSpy)
    const ui = render(<BgRemovalSection clipId="clip-one" edits={edits} onCommit={vi.fn()} />)
    await waitFor(() => expect(ui.getByTestId('bg-removal-note').textContent).toContain('credits'))
    expect(ui.queryByTestId('bg-matte-preview')).toBeNull()
    expect(fetchSpy).toHaveBeenCalledWith('/api/clips/clips/clip-one/bg-matte', expect.objectContaining({ method: 'POST' }))
  })

  it('E2 shows backend failures and offers retry instead of telling users to export', async () => {
    const edits = { ...defaultEdits(bounds), bgRemoval: { ...BG_DEFAULT, enabled: true } }
    const fetchSpy = vi.fn(async (rawUrl: string, opts?: { method?: string }) => ({
      ok: opts?.method !== 'POST',
      json: async () => opts?.method === 'POST' ? { error: 'GPU temporarily unavailable' }
        : rawUrl.includes('bg-matte') ? { data: { state: 'failed', url: null } }
        : { data: { render: null } },
    }))
    vi.stubGlobal('fetch', fetchSpy)
    const ui = render(<BgRemovalSection clipId="clip-one" edits={edits} onCommit={vi.fn()} />)
    await waitFor(() => expect(ui.getByTestId('bg-matte-retry')).toBeTruthy())
    expect(ui.getByTestId('bg-removal-note').textContent).toContain('GPU temporarily unavailable')
    fireEvent.click(ui.getByTestId('bg-matte-retry'))
    await waitFor(() => expect(fetchSpy.mock.calls.filter(([, options]) => options?.method === 'POST')).toHaveLength(2))
  })
})
