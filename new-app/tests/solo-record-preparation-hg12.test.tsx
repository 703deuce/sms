// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { SoloRecordClient } from '@/components/recording/solo/solo-record-client'

const recorder = vi.hoisted(() => ({
  setArmed: vi.fn(),
  uploadRows: [] as unknown[],
  armed: false,
  recording: false,
  countdown: 0,
  recSeconds: 0,
  cameras: [],
  mics: [],
  cameraId: '',
  micId: '',
  setCameraId: vi.fn(),
  setMicId: vi.fn(),
  countdownEnabled: false,
  setCountdownEnabled: vi.fn(),
  startRecording: vi.fn(),
  stopRecording: vi.fn(),
}))

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }))
vi.mock('@/components/recording/editor/use-editor-recorder', () => ({ useEditorRecorder: () => recorder }))
vi.mock('@/lib/recording/chunk-store', () => ({ listUnfinishedTrackMetas: async () => [] }))
vi.mock('@/lib/recording/use-recording-enabled', () => ({ useRecordingEnabled: () => false }))
vi.mock('@/components/app/page-primitives', () => ({
  PageHeader: ({ title }: { title: string }) => <h1>{title}</h1>,
}))
vi.mock('@/components/recording/editor/editor-recorder-bar', () => ({
  EditorRecorderBar: ({ onTeleprompter, onStart }: { onTeleprompter: () => void; onStart: () => void }) => <div data-testid="recorder-controls">Recorder controls<button type="button" onClick={onTeleprompter}>Teleprompter</button><button type="button" onClick={onStart}>Start recording</button></div>,
}))
vi.mock('@/components/recording/rooms/upload-card', () => ({ RoomsUploadCard: () => null }))

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

describe('solo recorder preparation states (HG12)', () => {
  it('aborts a pending prepare request after 20s and offers manual Retry', async () => {
    vi.useFakeTimers()
    try {
      const fetchMock = vi.fn((_url: string, options: RequestInit) => new Promise((_, reject) => {
        options.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))
      }))
      vi.stubGlobal('fetch', fetchMock)
      render(<SoloRecordClient />)
      expect(screen.getByText('Preparing recording workspace…')).toBeTruthy()
      await act(async () => { await vi.advanceTimersByTimeAsync(20_010) })
      expect(screen.getByRole('alert').textContent).toContain('timed out')
      expect(screen.getByRole('button', { name: 'Retry preparation' })).toBeTruthy()
      expect(fetchMock).toHaveBeenCalledTimes(1)
    } finally {
      vi.useRealTimers()
    }
  })

  it('aborts in-flight preparation on navigation without arming the recorder', async () => {
    let signal: AbortSignal | undefined
    vi.stubGlobal('fetch', vi.fn((_url: string, options: RequestInit) => {
      signal = options.signal as AbortSignal
      return new Promise(() => {})
    }))
    const view = render(<SoloRecordClient />)
    expect(signal?.aborted).toBe(false)
    view.unmount()
    expect(signal?.aborted).toBe(true)
    expect(recorder.setArmed).not.toHaveBeenCalled()
  })

  it('shows honest loading and gives an explicit retry on preparation failure', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: false, json: async () => ({ error: 'Preparation unavailable' }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({
        data: { projectId: 'fixture_project', sessionId: 'fixture_session' },
      }) })
    vi.stubGlobal('fetch', fetchMock)

    render(<SoloRecordClient />)
    expect(screen.getByText('Preparing recording workspace…')).toBeTruthy()
    expect(await screen.findByRole('alert')).toHaveProperty('textContent', 'Preparation unavailable')
    expect(screen.queryByTestId('recorder-controls')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Retry preparation' }))
    await waitFor(() => expect(screen.getByTestId('recorder-controls')).toBeTruthy())
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(recorder.setArmed).toHaveBeenCalledWith(true)
  })

  it('allows opening and editing teleprompter notes without requesting media permission', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true, json: async () => ({ data: { projectId: 'fixture_project', sessionId: 'fixture_session' } }),
    }))
    const getUserMedia = vi.fn().mockRejectedValue(new Error('Permission denied'))
    vi.stubGlobal('navigator', Object.assign(Object.create(navigator), { mediaDevices: { getUserMedia } }))
    render(<SoloRecordClient />)
    await screen.findByTestId('recorder-controls')
    fireEvent.click(screen.getByRole('button', { name: 'Teleprompter' }))
    expect(screen.getByTestId('solo-teleprompter')).toBeTruthy()
    fireEvent.change(screen.getByRole('textbox', { name: 'Teleprompter script' }), { target: { value: 'Opening line' } })
    expect((screen.getByRole('textbox', { name: 'Teleprompter script' }) as HTMLTextAreaElement).value).toBe('Opening line')
    expect(getUserMedia).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Close teleprompter' }))
    expect(screen.queryByTestId('solo-teleprompter')).toBeNull()
  })

  it('does not start recording when mediaDevices is absent, and gives a clear HTTPS/permission message', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true, json: async () => ({ data: { projectId: 'fixture_project', sessionId: 'fixture_session' } }),
    }))
    vi.stubGlobal('navigator', Object.assign(Object.create(navigator), { mediaDevices: undefined }))
    render(<SoloRecordClient />)
    await screen.findByTestId('recorder-controls')
    fireEvent.click(screen.getByRole('button', { name: 'Start recording' }))
    expect(screen.getByTestId('solo-device-error').textContent).toContain('secure HTTPS origin')
    expect(recorder.startRecording).not.toHaveBeenCalled()
  })

  it('surfaces a denied device permission and permits manual Start retry', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true, json: async () => ({ data: { projectId: 'fixture_project', sessionId: 'fixture_session' } }),
    }))
    vi.stubGlobal('navigator', Object.assign(Object.create(navigator), {
      mediaDevices: { getUserMedia: vi.fn() },
    }))
    recorder.startRecording.mockRejectedValueOnce(new DOMException('Denied', 'NotAllowedError')).mockResolvedValueOnce(undefined)
    render(<SoloRecordClient />)
    await screen.findByTestId('recorder-controls')
    fireEvent.click(screen.getByRole('button', { name: 'Start recording' }))
    expect((await screen.findByTestId('solo-device-error')).textContent).toContain('access was denied')
    expect(recorder.startRecording).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', { name: 'Start recording' }))
    await waitFor(() => expect(screen.queryByTestId('solo-device-error')).toBeNull())
    expect(recorder.startRecording).toHaveBeenCalledTimes(2)
  })

  it('does not arm the recorder on an incomplete preparation response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true, json: async () => ({ data: { projectId: 'fixture_project' } }),
    }))
    render(<SoloRecordClient />)
    expect(await screen.findByRole('alert')).toHaveProperty('textContent', 'Recording preparation returned an incomplete response')
    expect(recorder.setArmed).not.toHaveBeenCalled()
  })
})
