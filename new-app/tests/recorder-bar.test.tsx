// @vitest-environment happy-dom
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { ClipRecorderBar } from '@/components/clips/editor/recording/recorder-bar'

vi.mock('@/components/recording/editor/teleprompter-panel', () => ({
  TeleprompterPanel: ({ open, scriptText, playing }: { open: boolean; scriptText: string; playing: boolean }) =>
    open ? (
      <div data-testid="teleprompter-panel" data-playing={playing ? '1' : '0'}>
        {scriptText}
      </div>
    ) : null,
}))

function barProps(over: Partial<React.ComponentProps<typeof ClipRecorderBar>> = {}) {
  return {
    mode: 'camera' as const,
    recording: false,
    countdown: null,
    recSeconds: 0,
    cameras: [],
    mics: [],
    cameraId: '',
    micId: '',
    onCameraId: vi.fn(),
    onMicId: vi.fn(),
    countdownEnabled: true,
    onCountdownEnabled: vi.fn(),
    mutePreview: false,
    onMutePreview: vi.fn(),
    placeMode: 'insert' as const,
    onPlaceMode: vi.fn(),
    bubbleOn: true,
    onBubbleOn: vi.fn(),
    bubbleCorner: 'se' as const,
    onBubbleCorner: vi.fn(),
    bubbleSize: 'M' as const,
    onBubbleSize: vi.fn(),
    analysers: null,
    previewStream: null,
    teleprompterOpen: false,
    onTeleprompterOpen: vi.fn(),
    scriptText: 'Line one for camera',
    onScriptText: vi.fn(),
    teleprompterPlaying: false,
    onDisarm: vi.fn(),
    onStart: vi.fn(),
    onStop: vi.fn(),
    onCancel: vi.fn(),
    ...over,
  }
}

describe('ClipRecorderBar teleprompter', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'AudioContext',
      class {
        createAnalyser = () => ({ fftSize: 2048, getFloatTimeDomainData: vi.fn() })
        close = vi.fn()
      } as unknown as typeof AudioContext,
    )
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it('opens TeleprompterPanel with script text when toggled', () => {
    const onOpen = vi.fn()
    const { rerender } = render(<ClipRecorderBar {...barProps({ onTeleprompterOpen: onOpen })} />)
    fireEvent.click(screen.getByTestId('recorder-teleprompter'))
    expect(onOpen).toHaveBeenCalledWith(true)
    rerender(<ClipRecorderBar {...barProps({ teleprompterOpen: true })} />)
    expect(screen.getByTestId('teleprompter-panel').textContent).toContain('Line one for camera')
  })

  it('passes playing while recording', () => {
    render(<ClipRecorderBar {...barProps({ teleprompterOpen: true, recording: true, teleprompterPlaying: true })} />)
    expect(screen.getByTestId('teleprompter-panel').getAttribute('data-playing')).toBe('1')
  })
})
