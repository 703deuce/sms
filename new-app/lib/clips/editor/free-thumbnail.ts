/** Q5: free cover frame text overlay presets (client-side canvas; no credits). */
export type FreeThumbOverlayPreset = 'none' | 'bold_title' | 'lower_third' | 'minimal'

export const FREE_THUMB_OVERLAY_PRESETS: { id: FreeThumbOverlayPreset; label: string }[] = [
  { id: 'none', label: 'No text' },
  { id: 'bold_title', label: 'Bold title' },
  { id: 'lower_third', label: 'Lower third' },
  { id: 'minimal', label: 'Minimal' },
]

export function drawFreeThumbnailOverlay(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  text: string,
  preset: FreeThumbOverlayPreset,
): void {
  const t = text.trim()
  if (!t || preset === 'none') return
  ctx.save()
  if (preset === 'bold_title') {
    ctx.font = `bold ${Math.round(h * 0.12)}px system-ui, sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = 'rgba(0,0,0,0.55)'
    ctx.fillRect(0, h * 0.35, w, h * 0.2)
    ctx.fillStyle = '#fff'
    ctx.strokeStyle = 'rgba(0,0,0,0.8)'
    ctx.lineWidth = Math.max(2, h * 0.008)
    ctx.strokeText(t, w / 2, h * 0.45, w * 0.9)
    ctx.fillText(t, w / 2, h * 0.45, w * 0.9)
  } else if (preset === 'lower_third') {
    const barH = h * 0.22
    ctx.fillStyle = 'rgba(15,23,42,0.85)'
    ctx.fillRect(0, h - barH, w, barH)
    ctx.font = `600 ${Math.round(barH * 0.35)}px system-ui, sans-serif`
    ctx.fillStyle = '#f8fafc'
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    ctx.fillText(t, w * 0.06, h - barH / 2, w * 0.88)
  } else {
    ctx.font = `600 ${Math.round(h * 0.07)}px system-ui, sans-serif`
    ctx.textAlign = 'left'
    ctx.textBaseline = 'bottom'
    ctx.fillStyle = 'rgba(0,0,0,0.45)'
    ctx.fillRect(0, h * 0.78, w, h * 0.22)
    ctx.fillStyle = '#fff'
    ctx.fillText(t, w * 0.05, h * 0.95, w * 0.9)
  }
  ctx.restore()
}

export async function captureVideoFrameBlob(
  videoUrl: string,
  frameMs: number,
  aspect: '9:16' | '16:9',
  overlayText: string,
  overlayPreset: FreeThumbOverlayPreset,
): Promise<Blob> {
  const video = document.createElement('video')
  video.crossOrigin = 'anonymous'
  video.muted = true
  video.playsInline = true
  video.preload = 'auto'
  video.src = videoUrl
  await new Promise<void>((resolve, reject) => {
    video.onloadeddata = () => resolve()
    video.onerror = () => reject(new Error('Could not load video for frame capture'))
  })
  const t = Math.max(0, frameMs / 1000)
  video.currentTime = t
  await new Promise<void>((resolve) => {
    video.onseeked = () => resolve()
  })
  const vw = video.videoWidth || 1280
  const vh = video.videoHeight || 720
  const [tw, th] = aspect === '9:16' ? [720, 1280] : [1280, 720]
  const canvas = document.createElement('canvas')
  canvas.width = tw
  canvas.height = th
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas unavailable')
  const scale = Math.max(tw / vw, th / vh)
  const dw = vw * scale
  const dh = vh * scale
  ctx.drawImage(video, (tw - dw) / 2, (th - dh) / 2, dw, dh)
  drawFreeThumbnailOverlay(ctx, tw, th, overlayText, overlayPreset)
  return await new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Frame capture failed'))), 'image/jpeg', 0.92)
  })
}
