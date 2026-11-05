// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, waitFor } from '@testing-library/react'
import { BgRemovalSection } from '@/components/clips/editor/g4/bg-removal-section'
import { matteJobTimedOut, MATTE_PREVIEW_MAX_AGE_MS } from '@/lib/clips/editor/matte-job-status'
import { defaultEdits } from '@/lib/clips/edits'
import { BG_DEFAULT } from '@/lib/clips/editor/bg-removal'

afterEach(() => { cleanup(); vi.unstubAllGlobals() })
describe('Retest #8 F7 matte preview job status', () => {
  it('marks orphaned jobs retryable without timing out a fresh job', () => {
    const now = Date.parse('2026-11-05T12:00:00Z')
    const old = new Date(now - MATTE_PREVIEW_MAX_AGE_MS - 1)
    const fresh = new Date(now - 60_000)
    expect(matteJobTimedOut('RUNNING', old, now)).toBe(true)
    expect(matteJobTimedOut('QUEUED', old, now)).toBe(true)
    expect(matteJobTimedOut('RUNNING', fresh, now)).toBe(false)
    expect(matteJobTimedOut('SUCCEEDED', old, now)).toBe(false)
  })

  it('surfaces backend failure reason from polling and offers retry', async () => {
    const edits = { ...defaultEdits({clipStartMs:0,clipEndMs:22000}), bgRemoval: BG_DEFAULT }
    const fetchSpy = vi.fn(async (url: string, opts?: { method?: string }) => ({
      ok: true,
      json: async () => url.includes('bg-matte') ? (
        opts?.method === 'POST'
          ? { data: { state: 'queued', url: null } }
          : { data: { state: 'failed', url: null, error: 'Matte generation did not finish. Retry the preview.' } }
      ) : { data: { render: null } },
    }))
    vi.stubGlobal('fetch', fetchSpy)
    const ui = render(<BgRemovalSection clipId="clip_retest8" edits={edits} onCommit={vi.fn()} />)
    await waitFor(() => expect(ui.getByTestId('bg-matte-retry')).toBeTruthy())
    expect(ui.getByTestId('bg-removal-note').textContent).toContain('Matte generation did not finish')
  })
})
