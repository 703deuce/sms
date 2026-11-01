/**
 * G4c: read many frames of a media URL (scene detection / tracking) without touching the stage
 * video: a hidden CORS-mode <video> is seeked to each time and drawn small. URLs without CORS
 * cannot be read (same rule as scopes, frame-grab.ts).
 */
import { corsState } from './grade-gl'
import { isCrossOriginUrl } from './media-cors'

export type ScanFrame = { px: Uint8ClampedArray; w: number; h: number; t: number }
export type Scanner = { frameAt: (sec: number) => Promise<ScanFrame | null>; close: () => void; duration: number }

export async function openScanner(url: string, maxW = 96, timeoutMs = 8000): Promise<Scanner | { error: string }> {
  if (!url) return { error: 'No video loaded yet' }
  if (isCrossOriginUrl(url) && corsState(url) === 'no') return { error: 'This video does not allow pixel access (CORS)' }
  const v = document.createElement('video')
  if (isCrossOriginUrl(url)) v.crossOrigin = 'anonymous'
  v.muted = true
  v.preload = 'auto'
  v.playsInline = true
  v.src = url
  const ok = await new Promise<boolean>((resolve) => {
    const to = setTimeout(() => resolve(false), timeoutMs)
    v.addEventListener('loadeddata', () => (clearTimeout(to), resolve(true)), { once: true })
    v.addEventListener('error', () => (clearTimeout(to), resolve(false)), { once: true })
  })
  if (!ok || !v.videoWidth) {
    v.removeAttribute('src')
    return { error: 'Could not load the video for scanning' }
  }
  const sc = Math.min(1, maxW / v.videoWidth)
  const w = Math.max(1, Math.round(v.videoWidth * sc))
  const h = Math.max(1, Math.round(v.videoHeight * sc))
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const ctx = c.getContext('2d', { willReadFrequently: true })
  if (!ctx) return { error: 'No 2D canvas' }
  const frameAt = async (sec: number): Promise<ScanFrame | null> => {
    const t = Math.max(0, Math.min(sec, (v.duration || sec) - 0.001))
    await new Promise<void>((resolve) => {
      const to = setTimeout(resolve, 3000)
      v.addEventListener('seeked', () => (clearTimeout(to), resolve()), { once: true })
      v.currentTime = t
    })
    try {
      ctx.drawImage(v, 0, 0, w, h)
      return { px: ctx.getImageData(0, 0, w, h).data, w, h, t: v.currentTime }
    } catch {
      return null
    }
  }
  return {
    frameAt,
    duration: v.duration,
    close: () => {
      v.removeAttribute('src')
      v.load()
    },
  }
}
