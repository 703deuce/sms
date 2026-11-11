// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import { TextPanel } from '@/components/clips/editor/text-panel'
import { defaultEdits } from '@/lib/clips/edits'
import { waitForClipFont } from '@/lib/clips/font-manifest'

vi.mock('@/lib/clips/font-manifest', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/clips/font-manifest')>()
  return { ...actual, waitForClipFont: vi.fn(async () => {}) }
})

afterEach(() => { cleanup(); vi.mocked(waitForClipFont).mockReset().mockResolvedValue() })

describe('paired text treatment editor surface', () => {
  it('creates exactly two editable text layers in one named history commit on explicit click', async () => {
    const onEditsPass = vi.fn()
    const edits = defaultEdits({ clipStartMs: 0, clipEndMs: 60000 })
    const ui = render(<TextPanel edits={edits} onEdits={vi.fn()} onEditsPass={onEditsPass}
      playheadMs={3500} durationMs={60000} selectedId={null} onSelect={vi.fn()} />)
    fireEvent.click(ui.getByTestId('text-typography-editorial-contrast'))
    await waitFor(() => expect(onEditsPass).toHaveBeenCalledOnce())
    const [next, label] = onEditsPass.mock.calls[0]!
    expect(label).toContain('Editorial Contrast')
    expect(next.textItems).toHaveLength(2)
    expect(next.textItems[0].style.font).toBe('Bebas Neue')
    expect(next.textItems[1].style.font).toBe('Poppins')
    expect(next.textItems.every((item: { startMs: number }) => item.startMs === 3500)).toBe(true)
    expect(edits.textItems).toBeUndefined()
    expect(waitForClipFont).toHaveBeenCalledTimes(2)
  })
  it('refuses to add a silently substituted font when verified loading fails', async () => {
    vi.mocked(waitForClipFont).mockRejectedValueOnce(new Error('clip_font_integrity_mismatch'))
    const onEdits = vi.fn()
    const ui = render(<TextPanel edits={defaultEdits({ clipStartMs: 0, clipEndMs: 60000 })}
      onEdits={onEdits} playheadMs={0} durationMs={60000} selectedId={null} onSelect={vi.fn()} />)
    fireEvent.click(ui.getByTestId('text-typography-neon-signal'))
    await waitFor(() => expect(waitForClipFont).toHaveBeenCalled())
    expect(onEdits).not.toHaveBeenCalled()
  })
})
