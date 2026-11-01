/**
 * G4b preview of per-B-roll layer effects (export: worker/clips_worker/layer_fx.py + broll_render):
 *   mask     the same low-res alpha grid (maskAlpha, MASK_SHORT short side, 100 ms steps) as a CSS
 *            mask-image on the item's fx wrapper (inside the keyframed box → moves with the layer,
 *            like the export's mask-before-motion), stretched like the export's bilinear scale;
 *   blend    CSS mix-blend-mode on the item's region (backdrop = composite below);
 *   reverse  per-tick seek: local t → in + own − (floor(t·30) + 1)/30 (export's reversed copy);
 *   key      WebGL mirror (grade-gl.ts) — wired by PreviewStage through GradePreview.apply.
 */
import { BLEND_CSS, maskAlpha, maskGeomAt, MASK_STEP_MS, type LayerFx, type LayerMask } from '@/lib/clips/editor/layer-fx'
import { BLUR_UNIT } from '@/lib/clips/editor/blur-regions'

const MAX_MASKS = 64
const masks = new Map<string, string>()

/** Export frame size for a stage box aspect (short side 1080, like the export presets). */
export function exportFrameFor(boxW: number, boxH: number): { W: number; H: number } {
  if (!(boxW > 0 && boxH > 0)) return { W: 1080, H: 1920 }
  return boxW >= boxH ? { W: Math.round((1080 * boxW) / boxH), H: 1080 } : { W: 1080, H: Math.round((1080 * boxH) / boxW) }
}

/** data: URL of the mask at item-local ms (cached per geometry). */
export function maskUrl(mask: LayerMask, localMs: number, W: number, H: number): string {
  const g = maskGeomAt(mask, localMs)
  const key = `${mask.shape}|${mask.invert ? 1 : 0}|${W}x${H}|${g.x},${g.y},${g.w},${g.h},${g.rot},${g.feather}`
  const hit = masks.get(key)
  if (hit) {
    masks.delete(key)
    masks.set(key, hit)
    return hit
  }
  const { mw, mh, alpha } = maskAlpha(mask.shape, g, Boolean(mask.invert), W, H)
  if (typeof document === 'undefined') return ''
  const c = document.createElement('canvas')
  c.width = mw
  c.height = mh
  const ctx = c.getContext('2d')
  if (!ctx) return ''
  const img = ctx.createImageData(mw, mh)
  for (let i = 0; i < alpha.length; i++) img.data[i * 4 + 3] = alpha[i]!
  ctx.putImageData(img, 0, 0)
  const url = c.toDataURL('image/png')
  masks.set(key, url)
  if (masks.size > MAX_MASKS) masks.delete(masks.keys().next().value as string)
  return url
}

function setMask(el: HTMLElement, url: string) {
  const v = url ? `url("${url}")` : ''
  if (!v) delete el.dataset.g4bMask
  const st = el.style as CSSStyleDeclaration & { webkitMaskImage?: string; webkitMaskSize?: string; webkitMaskRepeat?: string }
  if (st.maskImage === v && (!v || st.maskSize)) return
  st.maskImage = v
  st.webkitMaskImage = v
  st.maskSize = v ? '100% 100%' : ''
  st.webkitMaskSize = v ? '100% 100%' : ''
  st.maskRepeat = v ? 'no-repeat' : ''
  st.webkitMaskRepeat = v ? 'no-repeat' : ''
  if (v) el.dataset.g4bMask = '1'
  else delete el.dataset.g4bMask
}

/** Mask + blend for one item at item-local ms (clears what is off). */
export function applyLayerFx(fxEl: HTMLElement | null, regionEl: HTMLElement | null, fx: LayerFx | undefined, localMs: number, W: number, H: number) {
  if (fxEl) {
    if (fx?.mask) setMask(fxEl, maskUrl(fx.mask, localMs, W, H))
    else if (fxEl.dataset.g4bMask) setMask(fxEl, '')
  }
  if (regionEl) {
    const mode = fx?.blend ? BLEND_CSS[fx.blend] : ''
    if (regionEl.style.mixBlendMode !== mode) regionEl.style.mixBlendMode = mode
  }
}

/** Media time (s) for a reversed item at item-local ms (`ownMs` = the item's length). */
export function reversedMediaTime(inMs: number, ownMs: number, localMs: number): number {
  const k = Math.floor((Math.max(0, localMs) * 30) / 1000)
  const src = inMs + ownMs - ((k + 1) * 1000) / 30
  return Math.max(inMs, src) / 1000
}

export { MASK_STEP_MS }

/**
 * G4c blur region on the main video (export: blur_regions.py): a stage-sized div above the main
 * layer with backdrop-filter blur (sigma = amount/100 × BLUR_UNIT × displayed short side, the
 * export's unit on its own frame) masked by the same low-res grid as the export's alphamerge.
 * `region` null hides it. Faces mode previews the manual mask (the detector runs on export).
 */
export function applyBlurRegion(
  el: HTMLElement | null,
  region: { amount: number; mask: LayerMask } | null,
  localMs: number,
  W: number,
  H: number,
  boxShortPx: number,
  video?: HTMLVideoElement | null,
) {
  if (!el) return
  if (!region) {
    if (el.style.visibility !== 'hidden') el.style.visibility = 'hidden'
    return
  }
  if (el.style.visibility !== 'visible') el.style.visibility = 'visible'
  const sigma = Math.round((region.amount / 100) * BLUR_UNIT * Math.max(1, boxShortPx) * 100) / 100
  // G4cfix: draw the blurred main frame into the region's own canvas (works whatever the stacking /
  // backdrop root, and for no-CORS media: a tainted canvas still displays). Backdrop blur is only
  // the fallback for engines without CanvasRenderingContext2D.filter.
  const cv = el.querySelector('canvas')
  const drawn = Boolean(cv && video && drawBlurFrame(cv, video, el, sigma))
  const bf = drawn ? '' : `blur(${sigma}px)`
  const st = el.style as CSSStyleDeclaration & { webkitBackdropFilter?: string }
  if (st.backdropFilter !== bf) {
    st.backdropFilter = bf
    st.webkitBackdropFilter = bf
  }
  if (cv && !drawn && cv.style.display !== 'none') cv.style.display = 'none'
  setMask(el, maskUrl(region.mask, localMs, W, H))
}

/** Where a video's picture lands inside its element box (object-fit cover / contain / fill, centred). */
export function videoContentRect(
  box: { left: number; top: number; width: number; height: number },
  vw: number,
  vh: number,
  fit: string,
): { x: number; y: number; w: number; h: number } {
  if (!vw || !vh || fit === 'fill') return { x: box.left, y: box.top, w: box.width, h: box.height }
  const s = fit === 'contain' || fit === 'scale-down' ? Math.min(box.width / vw, box.height / vh) : Math.max(box.width / vw, box.height / vh)
  const w = vw * s
  const h = vh * s
  return { x: box.left + (box.width - w) / 2, y: box.top + (box.height - h) / 2, w, h }
}

function drawBlurFrame(cv: HTMLCanvasElement, video: HTMLVideoElement, host: HTMLElement, sigma: number): boolean {
  if (video.readyState < 2 || !video.videoWidth) return false
  const ctx = cv.getContext('2d')
  if (!ctx || !('filter' in ctx)) return false
  const hr = host.getBoundingClientRect()
  const vr = video.getBoundingClientRect()
  if (hr.width < 2 || hr.height < 2 || vr.width < 2) return false
  const w = Math.round(hr.width)
  const h = Math.round(hr.height)
  if (cv.width !== w) cv.width = w
  if (cv.height !== h) cv.height = h
  const fit = (typeof getComputedStyle !== 'undefined' ? getComputedStyle(video).objectFit : '') || 'contain'
  const r = videoContentRect({ left: vr.left - hr.left, top: vr.top - hr.top, width: vr.width, height: vr.height }, video.videoWidth, video.videoHeight, fit)
  ctx.clearRect(0, 0, w, h)
  ctx.filter = `blur(${sigma}px)`
  try {
    ctx.drawImage(video, r.x, r.y, r.w, r.h)
  } catch {
    return false
  }
  ctx.filter = 'none'
  if (cv.style.display !== 'block') cv.style.display = 'block'
  return true
}
