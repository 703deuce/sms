'use client'

import { useEffect, useRef, useState } from 'react'
import type { BgRemoval } from '@/lib/clips/editor/bg-removal'

/** Convert a grayscale person-matte frame into pixel alpha. */
export function applyMatteAlpha(
  foreground: Uint8ClampedArray,
  mask: Uint8ClampedArray,
): void {
  for (let i = 0; i < foreground.length; i += 4) {
    foreground[i + 3] = Math.round(
      (0.2126 * mask[i]! + 0.7152 * mask[i + 1]! + 0.0722 * mask[i + 2]!) *
      (foreground[i + 3]! / 255),
    )
  }
}

/** Align matte and picture using the same CSS object-fit framing. */
export function fitVideoFrame(
  videoW: number, videoH: number, width: number, height: number, fit: string,
): { sx: number; sy: number; sw: number; sh: number; dx: number; dy: number; dw: number; dh: number } {
  const vw = Math.max(1, videoW), vh = Math.max(1, videoH)
  if (fit === 'cover') {
    const sourceRatio = vw / vh
    const targetRatio = width / Math.max(1, height)
    const sw = sourceRatio > targetRatio ? vh * targetRatio : vw
    const sh = sourceRatio > targetRatio ? vh : vw / targetRatio
    return { sx: (vw - sw) / 2, sy: (vh - sh) / 2, sw, sh, dx: 0, dy: 0, dw: width, dh: height }
  }
  if (fit === 'contain') {
    const scale = Math.min(width / vw, height / vh)
    const dw = vw * scale, dh = vh * scale
    return { sx: 0, sy: 0, sw: vw, sh: vh, dx: (width - dw) / 2, dy: (height - dh) / 2, dw, dh }
  }
  return { sx: 0, sy: 0, sw: vw, sh: vh, dx: 0, dy: 0, dw: width, dh: height }
}

/** Real subject-mask compositing for the first six seconds of a clip.
 * The worker stores an actual 6s grayscale person matte; this uses the same
 * video frame and the real mask rather than drawing an approximate silhouette.
 */
export function BgMatteCompositePreview({
  clipId, video, outMs, enabled, removal,
}: {
  clipId: string
  video: React.RefObject<HTMLVideoElement | null>
  outMs: React.RefObject<number>
  enabled: boolean
  removal: BgRemoval | undefined
}) {
  const [maskUrl, setMaskUrl] = useState<string | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const maskRef = useRef<HTMLVideoElement>(null)
  const workingRef = useRef<{ frame: HTMLCanvasElement; mask: HTMLCanvasElement; foreground: HTMLCanvasElement } | null>(null)
  const [renderable, setRenderable] = useState(false)
  const quality = removal?.quality ?? 'standard'

  useEffect(() => {
    if (!enabled || !clipId) {
      setMaskUrl(null)
      return
    }
    let stopped = false
    let timer: ReturnType<typeof setTimeout> | undefined
    const fetchStatus = async () => {
      try {
        const response = await fetch(`/api/clips/clips/${encodeURIComponent(clipId)}/bg-matte?quality=${quality}`, { cache: 'no-store' })
        if (!response.ok) throw new Error('matte preview status failed')
        const json = await response.json()
        if (stopped) return
        if (json.data?.state === 'ready' && typeof json.data?.url === 'string') {
          setMaskUrl(json.data.url)
          return
        }
        if (json.data?.state === 'failed') return
      } catch { /* Inspector owns error reporting/retry. */ }
      if (!stopped) timer = setTimeout(fetchStatus, 3500)
    }
    void fetchStatus()
    return () => { stopped = true; if (timer) clearTimeout(timer); setMaskUrl(null) }
  }, [clipId, quality, enabled])

  useEffect(() => {
    const main = video.current
    const matte = maskRef.current
    if (!enabled || !maskUrl || !main || !matte) return
    const followPlayback = () => {
      if (main.paused) matte.pause()
      else void matte.play().catch(() => { /* The rAF below can seek individual mask frames. */ })
    }
    main.addEventListener('play', followPlayback)
    main.addEventListener('pause', followPlayback)
    matte.addEventListener('canplay', followPlayback)
    followPlayback()
    return () => {
      main.removeEventListener('play', followPlayback)
      main.removeEventListener('pause', followPlayback)
      matte.removeEventListener('canplay', followPlayback)
      matte.pause()
    }
  }, [enabled, maskUrl, video])

  useEffect(() => {
    if (!enabled || !maskUrl) { setRenderable(false); return }
    const output = canvasRef.current
    const maskVideo = maskRef.current
    if (!output || !maskVideo) return
    let stopped = false
    let frameId = 0
    const frame = document.createElement('canvas')
    const matte = document.createElement('canvas')
    const foreground = document.createElement('canvas')
    workingRef.current = { frame, mask: matte, foreground }
    const paint = () => {
      if (stopped) return
      frameId = requestAnimationFrame(paint)
      const source = video.current
      const ms = outMs.current
      if (!source || source.readyState < 2 || maskVideo.readyState < 2 || ms < 0 || ms >= 6000) {
        output.style.visibility = 'hidden'
        return
      }
      const target = ms / 1000
      if (Math.abs(maskVideo.currentTime - target) > 0.12 && !maskVideo.seeking) {
        try { maskVideo.currentTime = target } catch { return }
      }
      if (maskVideo.seeking || Math.abs(maskVideo.currentTime - target) > 0.18) return
      const rect = output.getBoundingClientRect()
      const width = Math.max(1, Math.round(rect.width))
      const height = Math.max(1, Math.round(rect.height))
      if (!width || !height) return
      const scale = Math.min(1, 640 / Math.max(width, height))
      const w = Math.max(1, Math.round(width * scale))
      const h = Math.max(1, Math.round(height * scale))
      try {
        if (output.width !== w || output.height !== h) {
          output.width = w; output.height = h
          frame.width = w; frame.height = h
          matte.width = w; matte.height = h
          foreground.width = w; foreground.height = h
        }
        const fc = frame.getContext('2d', { willReadFrequently: true })
        const mc = matte.getContext('2d', { willReadFrequently: true })
        const fg = foreground.getContext('2d', { willReadFrequently: true })
        const ctx = output.getContext('2d')
        if (!fc || !mc || !fg || !ctx) return
        fc.clearRect(0, 0, w, h)
        // Main editor video normally uses object-contain; preserve the full frame.
        const fit = window.getComputedStyle(source).objectFit || 'contain'
        const pic = fitVideoFrame(source.videoWidth, source.videoHeight, w, h, fit)
        const maskFit = fitVideoFrame(maskVideo.videoWidth, maskVideo.videoHeight, w, h, fit)
        fc.drawImage(source, pic.sx, pic.sy, pic.sw, pic.sh, pic.dx, pic.dy, pic.dw, pic.dh)
        mc.clearRect(0, 0, w, h)
        mc.drawImage(maskVideo, maskFit.sx, maskFit.sy, maskFit.sw, maskFit.sh, maskFit.dx, maskFit.dy, maskFit.dw, maskFit.dh)
        const src = fc.getImageData(0, 0, w, h)
        const mask = mc.getImageData(0, 0, w, h)
        // Soft, grayscale matte: luminance is the subject alpha.
        applyMatteAlpha(src.data, mask.data)
        fg.putImageData(src, 0, 0)
        ctx.clearRect(0, 0, w, h)
        const background = removal?.background
        if (background?.type === 'color') {
          ctx.fillStyle = `#${background.color}`
          ctx.fillRect(0, 0, w, h)
        } else if (background?.type === 'blur') {
          ctx.filter = `blur(${Math.max(1, (background.amount / 100) * 35)}px)`
          ctx.drawImage(frame, 0, 0, w, h)
          ctx.filter = 'none'
        } else if (background?.type !== 'none') {
          ctx.fillStyle = '#000000'
          ctx.fillRect(0, 0, w, h)
        }
        ctx.drawImage(foreground, 0, 0, w, h)
        output.style.visibility = 'visible'
        setRenderable(true)
      } catch {
        // CORS-protected or not-yet-decoded media: keep the normal editor video
        // instead of presenting a false or broken cutout.
        output.style.visibility = 'hidden'
      }
    }
    frameId = requestAnimationFrame(paint)
    return () => {
      stopped = true
      cancelAnimationFrame(frameId)
      output.style.visibility = 'hidden'
      workingRef.current = null
    }
  }, [enabled, maskUrl, video, outMs, removal])

  if (!enabled || !clipId) return null
  return (
    <>
      {maskUrl ? (
        <video ref={maskRef} crossOrigin="anonymous" src={maskUrl} muted playsInline preload="auto"
          data-own-clock="1"
          className="hidden" aria-hidden data-testid="preview-person-matte-video" />
      ) : null}
      <canvas ref={canvasRef} data-testid="preview-person-cutout" data-matte-rendered={renderable ? 'true' : 'false'}
        aria-label="Background removal composite preview"
        className="pointer-events-none absolute inset-0 z-[2] size-full"
        style={{ visibility: 'hidden' }} />
    </>
  )
}
