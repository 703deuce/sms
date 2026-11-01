// @vitest-environment happy-dom
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useClipRecorder } from '@/components/clips/editor/recording/use-clip-recorder'

const buildScreenRecordStream = vi.fn()

vi.mock('@/components/clips/editor/recording/screen-compositor', () => ({
  buildScreenRecordStream: (...args: unknown[]) => buildScreenRecordStream(...args),
}))

class MockMediaRecorder {
  static isTypeSupported = () => true
  state = 'inactive'
  mimeType = 'video/webm'
  ondataavailable: ((e: { data: Blob }) => void) | null = null
  constructor(public stream: MediaStream, _o?: MediaRecorderOptions) {}
  start() {
    this.state = 'recording'
    queueMicrotask(() => this.ondataavailable?.({ data: new Blob(['x'], { type: 'video/webm' }) }))
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

describe('useClipRecorder screen', () => {
  let displayStream: MediaStream
  let onDisplayEnded: (() => void) | undefined
  let finishCalls = 0

  beforeEach(() => {
    vi.useFakeTimers()
    finishCalls = 0
    vi.stubGlobal('MediaRecorder', MockMediaRecorder as unknown as typeof MediaRecorder)
    const vTrack = { stop: vi.fn(), getSettings: () => ({ width: 1280, height: 720 }) } as unknown as MediaStreamTrack
    displayStream = new MediaStream([vTrack])
    buildScreenRecordStream.mockImplementation(async (input: { displayStream: MediaStream; bubbleOn: boolean; onDisplayEnded?: () => void }) => {
      onDisplayEnded = input.onDisplayEnded
      return {
        stream: input.bubbleOn ? new MediaStream([vTrack]) : input.displayStream,
        canvasW: 1280,
        canvasH: 720,
        stop: vi.fn(),
      }
    })
    vi.stubGlobal(
      'navigator',
      {
        mediaDevices: {
          getUserMedia: vi.fn(async () => new MediaStream([{ stop: vi.fn() } as unknown as MediaStreamTrack])),
          getDisplayMedia: vi.fn(async () => displayStream),
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
    buildScreenRecordStream.mockReset()
  })

  it('uses display stream directly when bubble is off', async () => {
    const { result, unmount } = renderHook(() => useClipRecorder('proj_screen'))
    act(() => {
      result.current.setCountdownEnabled(false)
      result.current.setBubbleOn(false)
      result.current.arm('screen')
    })
    await act(async () => {
      await result.current.startRecording()
    })
    expect(buildScreenRecordStream).toHaveBeenCalledWith(expect.objectContaining({ bubbleOn: false }))
    unmount()
  })

  it('stops once when display sharing ends', async () => {
    const { result, unmount } = renderHook(() => useClipRecorder('proj_screen'))
    act(() => {
      result.current.setCountdownEnabled(false)
      result.current.setBubbleOn(false)
      result.current.arm('screen')
    })
    await act(async () => {
      await result.current.startRecording({
        onFinish: () => {
          finishCalls += 1
        },
      })
    })
    await act(async () => {
      onDisplayEnded?.()
      onDisplayEnded?.()
      await Promise.resolve()
    })
    expect(finishCalls).toBe(1)
    unmount()
  })
})
