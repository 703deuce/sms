/**
 * Composites display + optional camera bubble + mixed audio for PR-07 screen takes.
 * Chrome may throttle background tabs — keep this tab visible while recording (see draw loop stall).
 */
import { bubbleRect, evenCanvasDims, type BubbleCorner, type BubbleSize } from '@/lib/clips/editor/recording-bubble'

export type ScreenCompositorInput = {
  displayStream: MediaStream
  cameraStream: MediaStream | null
  bubbleOn: boolean
  corner: BubbleCorner
  size: BubbleSize
  micStream: MediaStream | null
  onDisplayEnded?: () => void
  onDrawStall?: () => void
}

export type ScreenCompositorResult = {
  stream: MediaStream
  canvasW: number
  canvasH: number
  stop: () => void
}

const STALL_MS = 1000

function waitVideoReady(v: HTMLVideoElement): Promise<void> {
  if (v.readyState >= 2) return Promise.resolve()
  return new Promise((resolve, reject) => {
    v.onloadeddata = () => resolve()
    v.onerror = () => reject(new Error('video load failed'))
  })
}

/** When bubble is off, returns the display stream unchanged (no canvas). */
export async function buildScreenRecordStream(input: ScreenCompositorInput): Promise<ScreenCompositorResult> {
  const displayTrack = input.displayStream.getVideoTracks()[0]
  if (displayTrack) {
    displayTrack.addEventListener('ended', () => input.onDisplayEnded?.(), { once: true })
  }

  if (!input.bubbleOn || !input.cameraStream) {
    const micTracks = input.micStream?.getAudioTracks() ?? []
    if (micTracks.length === 0) {
      return {
        stream: input.displayStream,
        canvasW: displayTrack?.getSettings().width ?? 1920,
        canvasH: displayTrack?.getSettings().height ?? 1080,
        stop: () => {
          input.displayStream.getTracks().forEach((t) => t.stop())
        },
      }
    }
    const audioCtx = new AudioContext()
    const dest = audioCtx.createMediaStreamDestination()
    input.displayStream.getAudioTracks().forEach((t) => {
      audioCtx.createMediaStreamSource(new MediaStream([t])).connect(dest)
    })
    micTracks.forEach((t) => {
      audioCtx.createMediaStreamSource(new MediaStream([t])).connect(dest)
    })
    const out = new MediaStream([...(displayTrack ? [displayTrack] : []), ...dest.stream.getAudioTracks()])
    return {
      stream: out,
      canvasW: displayTrack?.getSettings().width ?? 1920,
      canvasH: displayTrack?.getSettings().height ?? 1080,
      stop: () => {
        void audioCtx.close()
        input.displayStream.getTracks().forEach((t) => t.stop())
        input.micStream?.getTracks().forEach((t) => t.stop())
      },
    }
  }

  const screenV = document.createElement('video')
  screenV.muted = true
  screenV.playsInline = true
  screenV.srcObject = new MediaStream([displayTrack!])

  const camV = document.createElement('video')
  camV.muted = true
  camV.playsInline = true
  const camTrack = input.cameraStream.getVideoTracks()[0]
  camV.srcObject = new MediaStream([camTrack!])

  await Promise.all([waitVideoReady(screenV), waitVideoReady(camV)])

  const sw = screenV.videoWidth || 1280
  const sh = screenV.videoHeight || 720
  const { w: canvasW, h: canvasH } = evenCanvasDims(sw, sh)

  const canvas = document.createElement('canvas')
  canvas.width = canvasW
  canvas.height = canvasH
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas not available')

  let raf = 0
  let lastDraw = performance.now()
  let stallNotified = false

  const draw = () => {
    if (!ctx) return
    ctx.drawImage(screenV, 0, 0, canvasW, canvasH)
    const { x, y, d } = bubbleRect(canvasW, canvasH, input.corner, input.size)
    ctx.save()
    ctx.beginPath()
    ctx.arc(x + d / 2, y + d / 2, d / 2, 0, Math.PI * 2)
    ctx.clip()
    ctx.drawImage(camV, x, y, d, d)
    ctx.restore()
    const now = performance.now()
    if (now - lastDraw > STALL_MS) {
      if (!stallNotified) {
        stallNotified = true
        input.onDrawStall?.()
      }
    } else lastDraw = now
    raf = requestAnimationFrame(draw)
  }

  const rVFC = (screenV as HTMLVideoElement & { requestVideoFrameCallback?: (cb: () => void) => number })
    .requestVideoFrameCallback
  if (rVFC) {
    const loop = () => {
      draw()
      rVFC.call(screenV, loop)
    }
    rVFC.call(screenV, loop)
  } else {
    const tick = () => {
      draw()
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
  }

  void screenV.play()
  void camV.play()

  const videoStream = canvas.captureStream(30)
  const audioCtx = new AudioContext()
  const dest = audioCtx.createMediaStreamDestination()

  const hookAudio = (stream: MediaStream | null) => {
    stream?.getAudioTracks().forEach((t) => {
      audioCtx.createMediaStreamSource(new MediaStream([t])).connect(dest)
    })
  }
  hookAudio(input.displayStream)
  hookAudio(input.micStream)

  const out = new MediaStream([...videoStream.getVideoTracks(), ...dest.stream.getAudioTracks()])

  return {
    stream: out,
    canvasW,
    canvasH,
    stop: () => {
      if (raf) cancelAnimationFrame(raf)
      screenV.srcObject = null
      camV.srcObject = null
      void audioCtx.close()
      videoStream.getTracks().forEach((t) => t.stop())
      input.displayStream.getTracks().forEach((t) => t.stop())
      input.cameraStream?.getTracks().forEach((t) => t.stop())
      input.micStream?.getTracks().forEach((t) => t.stop())
    },
  }
}
