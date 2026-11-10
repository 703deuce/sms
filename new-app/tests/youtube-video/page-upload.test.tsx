// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'

const { uploadFileToProject, controller } = vi.hoisted(() => ({
  uploadFileToProject: vi.fn(),
  controller: {
    restoreRun: vi.fn(), setSources: vi.fn(), submit: vi.fn(), setTitle: vi.fn(),
    choose: vi.fn(), refresh: vi.fn(), requestRevert: vi.fn(), cancelRevert: vi.fn(),
    confirmRevert: vi.fn(), refetchPlayback: vi.fn(),
  },
}))

vi.mock('../../components/youtube-video/use-youtube-video', () => ({
  useYoutubeVideo: () => ({
    state: {
      phase: 'idle', submitLocked: false, clientRequestId: 'req_same', title: '',
      sources: [], run: null, creditLabel: null, error: null, chooseError: null,
      confirmRevert: false,
    },
    controller,
  }),
}))
vi.mock('../../lib/youtube-video-ui/upload-sources', () => ({
  uploadFileToProject: (...args: unknown[]) => uploadFileToProject(...args),
}))

import { YoutubeVideoPage } from '../../components/youtube-video/youtube-video-page'

describe('YouTube upload picker and dropzone', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    uploadFileToProject.mockResolvedValue({ kind: 'upload', projectId: 'proj_uploaded' })
    controller.submit.mockResolvedValue(undefined)
    window.history.replaceState({}, '', '/app/youtube-video')
  })
  afterEach(() => cleanup())

  it('opens exactly one picker from the explicit keyboard-accessible dropzone button', () => {
    render(<YoutubeVideoPage />)
    const dropzone = screen.getByTestId('youtube-video-dropzone')
    const input = screen.getByTestId('youtube-video-upload') as HTMLInputElement
    const click = vi.spyOn(input, 'click')
    expect(dropzone.tagName).toBe('BUTTON')
    fireEvent.click(dropzone)
    expect(click).toHaveBeenCalledTimes(1)
  })

  it('accepts dropped videos, rejects non-video drops, and deduplicates same-file reselection', () => {
    render(<YoutubeVideoPage />)
    const dropzone = screen.getByTestId('youtube-video-dropzone')
    const input = screen.getByTestId('youtube-video-upload') as HTMLInputElement
    const video = new File(['video'], 'talk.mp4', { type: 'video/mp4', lastModified: 1 })
    fireEvent.drop(dropzone, { dataTransfer: { files: [video], dropEffect: 'none' } })
    expect(screen.getByText('talk.mp4')).toBeTruthy()
    fireEvent.change(input, { target: { files: [video] } })
    expect(screen.getAllByText('talk.mp4')).toHaveLength(1)
    fireEvent.change(input, { target: { files: [] } })
    expect(screen.getAllByText('talk.mp4')).toHaveLength(1)
    const text = new File(['no'], 'notes.txt', { type: 'text/plain', lastModified: 2 })
    fireEvent.drop(dropzone, { dataTransfer: { files: [text], dropEffect: 'none' } })
    expect(screen.getByText('Choose video files only.')).toBeTruthy()
  })

  it('reuses an already-created upload source when create is retried in the same page session', async () => {
    render(<YoutubeVideoPage />)
    const input = screen.getByTestId('youtube-video-upload') as HTMLInputElement
    const video = new File(['video'], 'talk.mp4', { type: 'video/mp4', lastModified: 1 })
    fireEvent.change(input, { target: { files: [video] } })
    fireEvent.click(screen.getByTestId('youtube-video-submit'))
    await waitFor(() => expect(uploadFileToProject).toHaveBeenCalledTimes(1))
    fireEvent.click(screen.getByTestId('youtube-video-submit'))
    await waitFor(() => expect(controller.submit).toHaveBeenCalledTimes(2))
    expect(uploadFileToProject).toHaveBeenCalledTimes(1)
  })
})
