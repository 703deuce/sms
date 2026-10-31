/**
 * G4a: the main video's source frame at the playhead as RGBA bytes (ungraded). Reads the stage
 * <video> directly when it is CORS-clean; otherwise a hidden crossOrigin twin is seeked to the same
 * time (media URLs that do not allow CORS cannot be measured — the panel says so).
 */
import { corsState } from './grade-gl'
import { stageFrame } from './grade-preview'

export type Frame = { px: Uint8ClampedArray; w: number; h: number; t: number }

let twin: HTMLVideoElement | null = null

function draw(src: HTMLVideoElement, maxW: number): Frame {
  const sc = Math.min(1, maxW / src.videoWidth)
  const w = Math.max(1, Math.round(src.videoWidth * sc))
  const h = Math.max(1, Math.round(src.videoHeight * sc))
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const ctx = c.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('no 2D canvas')
  ctx.drawImage(src, 0, 0, w, h)
  return { px: ctx.getImageData(0, 0, w, h).data, w, h, t: src.currentTime }
}

export async function grabFrame(maxW = 256): Promise<Frame | { error: string }> {
  const v = stageFrame.video
  if (!v || v.readyState < 2 || !v.videoWidth) return { error: 'No video frame yet' }
  try {
    return draw(v, maxW)
  } catch {
    /* tainted — use the CORS twin */
  }
  const url = v.currentSrc || v.src
  const st = corsState(url)
  if (st === 'pending') return { error: 'Preparing frame access…' }
  if (st === 'no') return { error: 'This video does not allow pixel access (CORS), so scopes are unavailable' }
  if (!twin) {
    twin = document.createElement('video')
    twin.crossOrigin = 'anonymous'
    twin.muted = true
    twin.preload = 'auto'
    twin.playsInline = true
  }
  if (twin.src !== url) twin.src = url
  const t = v.currentTime
  const tw = twin
  await new Promise<void>((resolve) => {
    const done = () => resolve()
    const to = setTimeout(done, 4000)
    const seek = () => {
      if (Math.abs(tw.currentTime - t) < 0.001 && tw.readyState >= 2) {
        clearTimeout(to)
        return done()
      }
      tw.addEventListener(
        'seeked',
        () => {
          clearTimeout(to)
          done()
        },
        { once: true },
      )
      tw.currentTime = t
    }
    if (tw.readyState >= 1) seek()
    else tw.addEventListener('loadedmetadata', seek, { once: true })
  })
  if (tw.readyState < 2) return { error: 'Could not load the frame' }
  try {
    return draw(tw, maxW)
  } catch {
    return { error: 'This video does not allow pixel access (CORS), so scopes are unavailable' }
  }
}
