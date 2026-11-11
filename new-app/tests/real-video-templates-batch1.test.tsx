// @vitest-environment happy-dom
import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { routes } from '@/lib/routes'
import { useFullVideoModeHandoff } from '@/components/clips/editor/full-video-mode-handoff'

const { clipsFetch, toastError, toastMessage } = vi.hoisted(() => ({
  clipsFetch: vi.fn(),
  toastError: vi.fn(),
  toastMessage: vi.fn(),
}))

vi.mock('@/lib/clips-api', () => ({ clipsFetch }))
vi.mock('sonner', () => ({
  toast: {
    error: toastError,
    message: toastMessage,
  },
}))

const readyLink = {
  projectId: 'proj_full',
  clipId: 'clip_full',
  url: '/app/video-editor/proj_full/edit/clip_full?highlights=1',
  sourceMs: 0,
}

describe('real video templates Batch 1 mode handoff', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  afterEach(() => cleanup())

  it('keeps the Templates route contract stable while its destination can be labeled Layouts', () => {
    expect(routes.templateMode('project-a', 'clip-b')).toBe('/app/video-editor/project-a/templates/clip-b')
  })

  it('flushes before resolution and again before navigating to the actual full-video clip', async () => {
    clipsFetch.mockResolvedValue(readyLink)
    const flushSave = vi.fn().mockResolvedValue(undefined)
    const navigate = vi.fn()
    localStorage.setItem('transovo.editor.layoutView', 'script')

    const { result } = renderHook(() =>
      useFullVideoModeHandoff('clip_short', flushSave, navigate),
    )

    await act(async () => {
      await result.current.open()
    })

    expect(flushSave).toHaveBeenCalledTimes(2)
    expect(clipsFetch).toHaveBeenCalledTimes(1)
    expect(clipsFetch).toHaveBeenCalledWith('/api/clips/clips/clip_short/full-video-link')
    expect(navigate).toHaveBeenCalledTimes(1)
    expect(navigate).toHaveBeenCalledWith(readyLink.url)
    expect(localStorage.getItem('transovo.editor.layoutView')).toBe('timeline')
  })

  it('stays put and retains the current layout when the initial save is rejected', async () => {
    const flushSave = vi.fn().mockRejectedValue(new Error('save failed'))
    const navigate = vi.fn()
    localStorage.setItem('transovo.editor.layoutView', 'script')

    const { result } = renderHook(() =>
      useFullVideoModeHandoff('clip_short', flushSave, navigate),
    )

    await act(async () => {
      await result.current.open()
    })

    expect(clipsFetch).not.toHaveBeenCalled()
    expect(navigate).not.toHaveBeenCalled()
    expect(localStorage.getItem('transovo.editor.layoutView')).toBe('script')
    expect(toastError).toHaveBeenCalledWith(expect.stringContaining('Save failed'))
  })

  it('does not navigate when a final pre-navigation flush fails after resolution', async () => {
    clipsFetch.mockResolvedValue(readyLink)
    const flushSave = vi.fn()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('late save failed'))
    const navigate = vi.fn()
    localStorage.setItem('transovo.editor.layoutView', 'script')

    const { result } = renderHook(() =>
      useFullVideoModeHandoff('clip_short', flushSave, navigate),
    )

    await act(async () => {
      await result.current.open()
    })

    expect(clipsFetch).toHaveBeenCalledTimes(1)
    expect(flushSave).toHaveBeenCalledTimes(2)
    expect(navigate).not.toHaveBeenCalled()
    expect(localStorage.getItem('transovo.editor.layoutView')).toBe('script')
    expect(toastError).toHaveBeenCalledWith(expect.stringContaining('Save failed'))
  })

  it('debounces duplicate Full video clicks while a handoff is in flight', async () => {
    let releaseFirstSave!: () => void
    const firstSave = new Promise<void>((resolve) => {
      releaseFirstSave = resolve
    })
    const flushSave = vi.fn()
      .mockImplementationOnce(() => firstSave)
      .mockResolvedValue(undefined)
    clipsFetch.mockResolvedValue(readyLink)
    const navigate = vi.fn()

    const { result } = renderHook(() =>
      useFullVideoModeHandoff('clip_short', flushSave, navigate),
    )

    await act(async () => {
      const first = result.current.open()
      const duplicate = result.current.open()
      releaseFirstSave()
      await Promise.all([first, duplicate])
    })

    expect(clipsFetch).toHaveBeenCalledTimes(1)
    expect(flushSave).toHaveBeenCalledTimes(2)
    expect(navigate).toHaveBeenCalledTimes(1)
  })

  it('shows an explicit unavailable reason instead of navigating to a broken URL', async () => {
    clipsFetch.mockResolvedValue(null)
    const flushSave = vi.fn().mockResolvedValue(undefined)
    const navigate = vi.fn()

    const { result } = renderHook(() =>
      useFullVideoModeHandoff('clip_without_source', flushSave, navigate),
    )

    await act(async () => {
      await result.current.open()
    })

    expect(flushSave).toHaveBeenCalledTimes(1)
    expect(navigate).not.toHaveBeenCalled()
    expect(toastError).toHaveBeenCalledWith(expect.stringContaining('unavailable'))
  })
})
