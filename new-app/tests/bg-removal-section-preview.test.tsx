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
  })
})
