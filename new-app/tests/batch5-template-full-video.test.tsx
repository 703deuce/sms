// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, renderHook } from '@testing-library/react'
import { TemplatesPanel } from '@/components/clips/editor/templates-panel'
import { OpenInFullVideoButton } from '@/components/clips/editor/open-in-full-video-button'
import { EditorModeSwitcher } from '@/components/clips/editor/editor-mode-switcher'
import { useFullVideoModeHandoff } from '@/components/clips/editor/full-video-mode-handoff'
import { defaultEdits } from '@/lib/clips/edits'

const { clipsFetch, toastError, toastMessage } = vi.hoisted(() => ({
  clipsFetch: vi.fn(),
  toastError: vi.fn(),
  toastMessage: vi.fn(),
}))

vi.mock('@/lib/clips-api', () => ({ clipsFetch }))
vi.mock('sonner', () => ({ toast: { error: toastError, message: toastMessage } }))

vi.mock('next/navigation', () => ({
  usePathname: () => '/app/video-editor/project/edit/clip',
  useRouter: () => ({ push: vi.fn() }),
}))
afterEach(() => cleanup())

describe('Batch 5 editor surface', () => {
  it('N4 removes background-removal from Templates while keeping actual templates', () => {
    const ui = render(<TemplatesPanel
      edits={defaultEdits({ clipStartMs: 0, clipEndMs: 20_000 })}
      onEdits={vi.fn()}
      layoutSlot={<div>Layouts available</div>}
      brandTemplates={[]}
      onApplyBrand={vi.fn()}
      playheadMs={3000}
      durationMs={20_000}
    />)
    expect(ui.queryByTestId('bg-remove-toggle')).toBeNull()
    expect(ui.getByTestId('templates-starters')).toBeTruthy()
    expect(ui.getByTestId('templates-layouts')).toBeTruthy()
  })

  it('Batch 1 exposes Full video as the sixth shared destination and keeps templates id as Layouts', () => {
    const onSelect = vi.fn()
    const ui = render(<EditorModeSwitcher current="clip" onSelect={onSelect} />)
    expect(ui.getByTestId('editor-mode-switcher').querySelectorAll('button')).toHaveLength(6)
    expect(ui.getByTestId('editor-mode-templates').textContent).toBe('Layouts')
    expect(ui.getByTestId('editor-mode-full-video').textContent).toBe('Full video')
    ui.getByTestId('editor-mode-full-video').click()
    expect(onSelect).toHaveBeenCalledWith('full-video')
  })

  it('Batch 1 flushes before the actual full-video route and forces Timeline only on success', async () => {
    vi.clearAllMocks()
    localStorage.setItem('transovo.editor.layoutView', 'script')
    clipsFetch.mockResolvedValue({
      projectId: 'proj_full',
      clipId: 'clip_full',
      sourceMs: 0,
      url: '/app/video-editor/proj_full/edit/clip_full?highlights=1',
    })
    const flushSave = vi.fn().mockResolvedValue(undefined)
    const navigate = vi.fn()
    const { result } = renderHook(() => useFullVideoModeHandoff('clip_short', flushSave, navigate))

    await act(async () => {
      await result.current.open()
    })

    expect(flushSave).toHaveBeenCalledTimes(2)
    expect(navigate).toHaveBeenCalledWith('/app/video-editor/proj_full/edit/clip_full?highlights=1')
    expect(localStorage.getItem('transovo.editor.layoutView')).toBe('timeline')
  })

  it('Batch 1 rejected save stays in place and does not rewrite the layout preference', async () => {
    vi.clearAllMocks()
    localStorage.setItem('transovo.editor.layoutView', 'script')
    const flushSave = vi.fn().mockRejectedValue(new Error('save failed'))
    const navigate = vi.fn()
    const { result } = renderHook(() => useFullVideoModeHandoff('clip_short', flushSave, navigate))

    await act(async () => {
      await result.current.open()
    })

    expect(clipsFetch).not.toHaveBeenCalled()
    expect(navigate).not.toHaveBeenCalled()
    expect(localStorage.getItem('transovo.editor.layoutView')).toBe('script')
    expect(toastError).toHaveBeenCalledWith(expect.stringContaining('Save failed'))
  })

  it('C5 shows a readable full-video action at laptop width instead of icon-only', () => {
    const ui = render(<OpenInFullVideoButton clipId="clip1" />)
    const action = ui.getByTestId('open-in-full-video')
    expect(action.textContent).toContain('Open in full video')
    expect(action.querySelector('span')?.className).not.toContain('sr-only')
  })
})


