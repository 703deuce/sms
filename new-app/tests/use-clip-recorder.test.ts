// @vitest-environment happy-dom
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useClipRecorder } from '@/components/clips/editor/recording/use-clip-recorder'

class MockMediaRecorder {
  static isTypeSupported = () => true
  state = 'inactive'
  mimeType = 'audio/webm'
  ondataavailable: ((e: { data: Blob }) => void) | null = null
  constructor(_s: MediaStream, _o?: MediaRecorderOptions) {}
  start() {
    this.state = 'recording'
    queueMicrotask(() => this.ondataavailable?.({ data: new Blob(['x'], { type: 'audio/webm' }) }))
  }
  stop() {
    this.state = 'inactive'
  }
  addEventListener(type: string, fn: () => void, opts?: { once?: boolean }) {
    if (type === 'stop') {
      queueMicrotask(() => {
        fn()
        if (opts?.once) this.removeEventListener(type, fn)
      })
    }
  }
  removeEventListener() {}
}

describe('useClipRecorder', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.stubGlobal('MediaRecorder', MockMediaRecorder as unknown as typeof MediaRecorder)
    const track = { stop: vi.fn(), getSettings: () => ({}) } as unknown as MediaStreamTrack
    vi.stubGlobal(
      'navigator',
      {
        mediaDevices: {
          getUserMedia: vi.fn(async () => new MediaStream([track])),
          enumerateDevices: vi.fn(async () => []),
        },
      } as Navigator,
    )
    vi.stubGlobal(
      'AudioContext',
      class {
        createMediaStreamSource = () => ({ connect: vi.fn() })
        createAnalyser = () => ({ fftSize: 2048, getFloatTimeDomainData: vi.fn() })
        close = vi.fn(async () => {})
      } as unknown as typeof AudioContext,
    )
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('runs countdown then starts recording', async () => {
    const { result, unmount } = renderHook(() => useClipRecorder('proj_test'))
    act(() => result.current.arm('voiceover'))
    await act(async () => {
      const p = result.current.startRecording()
      await vi.advanceTimersByTimeAsync(3100)
      await p
    })
    expect(result.current.recording).toBe(true)
    expect(result.current.countdownLeadMs()).toBe(3000)
    unmount()
  })

  it('cancelRecording discards without pending take', async () => {
    const { result, unmount } = renderHook(() => useClipRecorder('proj_test'))
    act(() => {
      result.current.setCountdownEnabled(false)
      result.current.arm('voiceover')
    })
    await act(async () => {
      await result.current.startRecording()
    })
    await act(async () => {
      await result.current.cancelRecording()
    })
    expect(result.current.pendingTake).toBeNull()
    expect(result.current.armed).toBe(false)
    unmount()
  })

  it('countdown disabled skips lead time', async () => {
    const { result, unmount } = renderHook(() => useClipRecorder('proj_test'))
    act(() => {
      result.current.setCountdownEnabled(false)
      result.current.arm('voiceover')
    })
    expect(result.current.countdownLeadMs()).toBe(0)
    unmount()
  })
})
