/**
 * E3 preview controller: applies lib/clips/editor/motion-frame.ts styles to the preview DOM on
 * every rAF tick of PreviewStage. Cut transitions use two muted clones of the main layer
 * (A = outgoing clip continued past the cut, B = incoming clip started before it), exactly the
 * handle frames the export's xfade uses; the real main layer keeps playing (audio, clock) hidden.
 */
import type { ClipEditsV2 } from '@/lib/clips/edits'
import type { Timebase } from '@/lib/clips/editor/clip-timeline'
import { videoTimeFromSourceMs } from '@/lib/clips/editor-playback'
import { brollFrame, hookFrame, mainFrame, type FrameStyle } from '@/lib/clips/editor/motion-frame'
import { SHADER_TRANSITIONS, TRANSITION_INFO, transitionMaskAlpha, type LayerCss } from '@/lib/clips/editor/transitions'
import { TransitionGL } from '@/components/clips/editor/g4/transition-gl'
import type { ShaderType } from '@/lib/clips/editor/g4/transition-shaders.gen'

export type MotionDom = {
  under: HTMLElement | null
  mainKf: HTMLElement | null
  mainLayer: HTMLElement | null
  cloneA: HTMLElement | null
  cutDip: HTMLElement | null
  cloneB: HTMLElement | null
  brollBox: Record<string, HTMLElement | null>
  brollDip: Record<string, HTMLElement | null>
  hook: HTMLElement | null
}

function setStyle(el: HTMLElement | null, s: Partial<FrameStyle> | LayerCss | null) {
  if (!el) return
  if (!s) {
    if (el.style.visibility !== 'hidden') el.style.visibility = 'hidden'
    return
  }
  const st = el.style
  const tf = s.transform ?? ''
  if (st.transform !== tf) st.transform = tf
  const op = String(s.opacity ?? 1)
  if (st.opacity !== op) st.opacity = op
  const cp = s.clipPath ?? ''
  if (st.clipPath !== cp) st.clipPath = cp
  const fl = s.filter ?? ''
  if (st.filter !== fl) st.filter = fl
  const vis = s.visibility ?? 'visible'
  if (st.visibility !== vis) st.visibility = vis
  setTransitionMask(el, s.mask ?? '')
}

// G4b mask transitions: the top layer gets a CSS mask image = the xfade weight (transitions.ts).
const maskUrls = new Map<string, string>()
function maskUrl(key: string, W: number, H: number): string {
  const k = `${key}|${W}x${H}`
  const hit = maskUrls.get(k)
  if (hit) return hit
  const [xfade, p, top] = key.split('|')
  const { mw, mh, alpha } = transitionMaskAlpha(xfade!, Number(p), top === 'A' ? 'A' : 'B', W, H)
  let url = ''
  try {
    const c = document.createElement('canvas')
    c.width = mw
    c.height = mh
    const ctx = c.getContext('2d')
    if (ctx) {
      const img = ctx.createImageData(mw, mh)
      for (let i = 0; i < alpha.length; i++) {
        img.data[i * 4] = 255
        img.data[i * 4 + 1] = 255
        img.data[i * 4 + 2] = 255
        img.data[i * 4 + 3] = alpha[i]!
      }
      ctx.putImageData(img, 0, 0)
      url = `url(${c.toDataURL()})`
    }
  } catch {
    url = ''
  }
  if (maskUrls.size > 240) maskUrls.clear()
  maskUrls.set(k, url)
  return url
}

function setTransitionMask(el: HTMLElement, key: string) {
  if ((el.dataset.tmask ?? '') === key) return
  const st = el.style as CSSStyleDeclaration & { webkitMaskImage?: string; webkitMaskSize?: string }
  if (!key) {
    delete el.dataset.tmask
    st.maskImage = ''
    st.webkitMaskImage = ''
    return
  }
  // Export frame size from the layer's aspect (short side 1080, like the export presets).
  const w = el.clientWidth || 9
  const h = el.clientHeight || 16
  const W = w <= h ? 1080 : Math.round((1080 * w) / h)
  const H = w <= h ? Math.round((1080 * h) / w) : 1080
  const url = maskUrl(key, W, H)
  el.dataset.tmask = key
  st.maskImage = url
  st.webkitMaskImage = url
  st.maskSize = '100% 100%'
  st.webkitMaskSize = '100% 100%'
  st.maskRepeat = 'no-repeat'
}

/** Deep-clone the main layer once per layout (muted, no test ids, no autoplay). */
export function ensureClone(host: HTMLElement | null, main: HTMLElement | null): HTMLVideoElement[] {
  if (!host || !main) return []
  const sig = `${main.childElementCount}:${main.querySelector('video')?.getAttribute('src') ?? ''}:${main.firstElementChild?.className ?? ''}`
  if (host.dataset.sig !== sig) {
    const copy = main.cloneNode(true) as HTMLElement
    copy.removeAttribute('data-testid')
    copy.querySelectorAll('[data-testid]').forEach((n) => n.removeAttribute('data-testid'))
    copy.style.visibility = 'visible'
    copy.style.transform = ''
    copy.querySelectorAll('canvas[data-g4-mirror]').forEach((n) => n.remove())
    copy.querySelectorAll('[data-g4-src="1"]').forEach((n) => n.removeAttribute('data-g4-src'))
    host.replaceChildren(copy)
    host.dataset.sig = sig
    host.querySelectorAll('video').forEach((v) => {
      v.muted = true
      v.removeAttribute('autoplay')
      v.preload = 'auto'
    })
  }
  return Array.from(host.querySelectorAll('video'))
}

export type TransitionSourceFrame = {
  sourceId: string
  mediaTimeSec: number
  fit: 'cover' | 'contain'
  transform: string
  clipPath: string
  filter: string
  rateMultiplier: number
}

export function syncClone(
  host: HTMLElement | null,
  main: HTMLElement | null,
  srcMs: number,
  mediaOffsetMs: number,
  playing: boolean,
  rate: number,
  look = '',
  gradeClone?: (layer: HTMLElement, vids: HTMLVideoElement[], srcMs: number) => boolean,
  sourceFrameAt?: (srcMs: number, side: 'a' | 'b', boundarySrcMs: number) => TransitionSourceFrame | null,
  sourceSide: 'a' | 'b' = 'a',
  boundarySrcMs = srcMs,
) {
  const vids = ensureClone(host, main)
  const layerRoot = host?.firstElementChild instanceof HTMLElement ? host.firstElementChild : null
  const graded = gradeClone && layerRoot ? gradeClone(layerRoot, vids, srcMs) : false
  const mains = main ? Array.from(main.querySelectorAll('video')) : []
  const t = videoTimeFromSourceMs(srcMs, mediaOffsetMs)
  vids.forEach((v, i) => {
    const m = mains[i]
    // Per-tick crop transforms (speaker-follow) are inline styles on the main videos.
    // E4: the clone's own colour look (its segment) lives on style.filter; compare without it.
    if (m && v.dataset.baseCss !== m.style.cssText) {
      v.style.cssText = m.style.cssText
      v.dataset.baseCss = m.style.cssText
      v.dataset.look = ''
    }
    if (!graded && (v.dataset.look ?? '') !== look) {
      v.style.filter = look
      v.dataset.look = look
    } else if (graded) {
      v.dataset.look = look
    }
    if (m && v.className !== m.className) v.className = m.className
    v.playbackRate = rate
    const drift = Math.abs(v.currentTime - t)
    if (drift > (playing ? 0.12 : 0.02)) {
      try {
        v.currentTime = t
      } catch {
        /* metadata not ready */
      }
    }
    if (playing && v.paused) void v.play().catch(() => {})
    if (!playing && !v.paused) v.pause()
  })
  if (host && sourceFrameAt) {
    const sf = sourceFrameAt(srcMs, sourceSide, boundarySrcMs)
    host.querySelectorAll<HTMLElement>('[data-source-id]').forEach((box) => {
      const active = Boolean(sf && box.dataset.sourceId === sf.sourceId)
      box.style.visibility = active ? 'visible' : 'hidden'
      if (!active || !sf) return
      box.style.transform = sf.transform
      box.style.clipPath = sf.clipPath
      box.style.filter = sf.filter
      box.style.transformOrigin = '50% 50%'
      const media = box.querySelector('video, img') as HTMLVideoElement | HTMLImageElement | null
      if (media) media.style.objectFit = sf.fit
      if (media instanceof HTMLVideoElement) {
        const driftLimit = sf.rateMultiplier === 0 ? 0.015 : sf.rateMultiplier !== 1 ? 0.04 : (playing ? 0.12 : 0.02)
        if (Math.abs(media.currentTime - sf.mediaTimeSec) > driftLimit) {
          try { media.currentTime = sf.mediaTimeSec } catch { /* metadata not ready */ }
        }
        if (sf.rateMultiplier > 0) {
          media.playbackRate = rate * sf.rateMultiplier
          if (playing && media.paused) void media.play().catch(() => {})
          if (!playing && !media.paused) media.pause()
        } else if (!media.paused) {
          media.pause()
        }
      }
    })
  }
}

function pauseClone(host: HTMLElement | null) {
  host?.querySelectorAll('video').forEach((v) => {
    if (!v.paused) v.pause()
  })
}

function exportFrameSize(boxW: number, boxH: number): { W: number; H: number } {
  const w = boxW || 9
  const h = boxH || 16
  const W = w <= h ? 1080 : Math.round((1080 * w) / h)
  const H = w <= h ? Math.round((1080 * h) / w) : 1080
  return { W, H }
}

function pixelCanvas(host: HTMLElement | null): HTMLCanvasElement | null {
  if (!host) return null
  let c = host.querySelector('canvas[data-testid="transition-pixel"]') as HTMLCanvasElement | null
  if (!c) {
    c = document.createElement('canvas')
    c.dataset.testid = 'transition-pixel'
    c.className = 'pointer-events-none absolute inset-0 h-full w-full'
    c.style.imageRendering = 'pixelated'
    host.appendChild(c)
  }
  return c
}

function drawPixelTransition(
  host: HTMLElement | null,
  aHost: HTMLElement | null,
  bHost: HTMLElement | null,
  pixel: { blockFrac: number; P: number },
  boxW: number,
  boxH: number,
  lookA: string,
  lookB: string,
) {
  const canvas = pixelCanvas(host)
  if (!canvas || !aHost || !bHost) return
  const { W, H } = exportFrameSize(boxW, boxH)
  const sq = Math.max(1, pixel.blockFrac * Math.min(W, H))
  const cw = Math.max(1, Math.ceil(W / sq))
  const ch = Math.max(1, Math.ceil(H / sq))
  if (canvas.width !== cw || canvas.height !== ch) {
    canvas.width = cw
    canvas.height = ch
  }
  canvas.style.visibility = 'visible'
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.imageSmoothingEnabled = false
  const va = aHost.querySelector('video') as HTMLVideoElement | null
  const vb = bHost.querySelector('video') as HTMLVideoElement | null
  const drawLayer = (v: HTMLVideoElement | null, alpha: number, filter: string) => {
    if (!v || v.readyState < 2) return
    ctx.save()
    ctx.globalAlpha = alpha
    ctx.filter = filter || 'none'
    ctx.drawImage(v, 0, 0, cw, ch)
    ctx.restore()
  }
  ctx.clearRect(0, 0, cw, ch)
  drawLayer(vb, 1, lookB)
  drawLayer(va, pixel.P, lookA)
}

function hidePixelCanvas(host: HTMLElement | null) {
  const c = host?.querySelector('canvas[data-testid="transition-pixel"]') as HTMLCanvasElement | null
  if (c && c.style.visibility !== 'hidden') c.style.visibility = 'hidden'
}

const SNAP_MAX = 1280
const snapPool = { a: null as HTMLCanvasElement | null, b: null as HTMLCanvasElement | null }

function snapCanvas(which: 'a' | 'b'): HTMLCanvasElement {
  const key = which === 'a' ? 'a' : 'b'
  if (!snapPool[key]) snapPool[key] = document.createElement('canvas')
  return snapPool[key]!
}

function snapshotClone(
  layer: HTMLElement | null,
  w: number,
  h: number,
  look: string,
  graded: boolean,
): HTMLCanvasElement | null {
  if (!layer || w < 2 || h < 2) return null
  const canvas = snapCanvas(layer.dataset.snapSide === 'b' ? 'b' : 'a')
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w
    canvas.height = h
  }
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  ctx.clearRect(0, 0, w, h)
  const v = layer.querySelector('video') as HTMLVideoElement | null
  const mirror = layer.querySelector('canvas[data-g4-mirror]') as HTMLCanvasElement | null
  if (graded && mirror && mirror.width > 0) {
    ctx.drawImage(mirror, 0, 0, w, h)
    return canvas
  }
  if (!v || v.readyState < 2) return null
  ctx.save()
  ctx.filter = look || 'none'
  ctx.drawImage(v, 0, 0, w, h)
  ctx.restore()
  return canvas
}

function shaderCanvas(host: HTMLElement | null): HTMLCanvasElement | null {
  if (!host) return null
  let c = host.querySelector('canvas[data-testid="transition-shader"]') as HTMLCanvasElement | null
  if (!c) {
    c = document.createElement('canvas')
    c.dataset.testid = 'transition-shader'
    c.className = 'pointer-events-none absolute inset-0 h-full w-full'
    host.appendChild(c)
  }
  return c
}

function hideShaderCanvas(host: HTMLElement | null) {
  const c = host?.querySelector('canvas[data-testid="transition-shader"]') as HTMLCanvasElement | null
  if (c && c.style.visibility !== 'hidden') c.style.visibility = 'hidden'
}

function drawShaderTransition(
  host: HTMLElement | null,
  aHost: HTMLElement | null,
  bHost: HTMLElement | null,
  shader: { type: ShaderType; progress: number },
  boxW: number,
  boxH: number,
  exportW: number,
  exportH: number,
  lookA: string,
  lookB: string,
  gradeClone?: (layer: HTMLElement, vids: HTMLVideoElement[], srcMs: number) => boolean,
  aSrcMs: number,
  bSrcMs: number,
): string | null {
  const canvas = shaderCanvas(host)
  if (!canvas || !aHost || !bHost) return 'no host'
  const vw = boxW || 9
  const vh = boxH || 16
  const sc = Math.min(1, SNAP_MAX / Math.max(vw, vh))
  const w = Math.max(2, Math.round(vw * sc))
  const h = Math.max(2, Math.round(vh * sc))
  if (aHost.dataset.snapSide !== 'a') aHost.dataset.snapSide = 'a'
  if (bHost.dataset.snapSide !== 'b') bHost.dataset.snapSide = 'b'
  const gradedA = Boolean(gradeClone?.(aHost, Array.from(aHost.querySelectorAll('video')), aSrcMs))
  const gradedB = Boolean(gradeClone?.(bHost, Array.from(bHost.querySelectorAll('video')), bSrcMs))
  const va = aHost.querySelector('video')
  const vb = bHost.querySelector('video')
  const urlA = va instanceof HTMLVideoElement ? va.currentSrc || va.src : ''
  const urlB = vb instanceof HTMLVideoElement ? vb.currentSrc || vb.src : ''
  if (urlA && TransitionGL.corsOk(va!) === 'pending') return null
  if (urlB && TransitionGL.corsOk(vb!) === 'pending') return null
  if (urlA && TransitionGL.corsOk(va!) === 'no') return 'CORS'
  if (urlB && TransitionGL.corsOk(vb!) === 'no') return 'CORS'
  const snapA = snapshotClone(aHost, w, h, lookA, gradedA)
  const snapB = snapshotClone(bHost, w, h, lookB, gradedB)
  if (!snapA || !snapB) return 'not ready'
  const gl = TransitionGL.get()
  if (!gl || !TransitionGL.ok(shader.type)) {
    return TransitionGL.status[shader.type]?.reason ?? 'WebGL2 unavailable'
  }
  try {
    gl.draw(shader.type, shader.progress, snapA, snapB, w, h, exportW, exportH)
  } catch (e) {
    if (e instanceof DOMException && e.name === 'SecurityError') {
      if (va) TransitionGL.onSecurityError(va)
      if (vb) TransitionGL.onSecurityError(vb)
      return 'CORS'
    }
    return e instanceof Error ? e.message : 'draw failed'
  }
  canvas.style.visibility = 'visible'
  const ctx = canvas.getContext('2d')
  if (!ctx) return '2d context'
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w
    canvas.height = h
  }
  ctx.clearRect(0, 0, w, h)
  ctx.drawImage(gl.canvas, 0, 0, w, h)
  return null
}

function shaderNoticeText(type: ShaderType, reason: string): string {
  const label = TRANSITION_INFO[type]?.label ?? type
  return `Preview shows a crossfade for ${label} (${reason}). The export renders the full effect.`
}

export function applyMotionFrame(
  dom: MotionDom,
  edits: ClipEditsV2,
  tb: Timebase,
  outMs: number,
  opts: {
    boxW: number
    boxH?: number
    playing: boolean
    rate: number
    mediaOffsetMs: number
    /** E4: CSS filter of the colour look at a source ms (clone A / B keep their own segment's look). */
    lookAt?: (srcMs: number) => string
    /** TR-06: grade clones through WebGL mirror; when true, syncClone skips style.filter. */
    gradeClone?: (layer: HTMLElement, vids: HTMLVideoElement[], srcMs: number) => boolean
    /** B3/E5: resolve an alternate-source frame for A/B transition clones. */
    sourceFrameAt?: (srcMs: number, side: 'a' | 'b', boundarySrcMs: number) => TransitionSourceFrame | null
    exportW?: number
    exportH?: number
    onShaderNotice?: (msg: string | null) => void
  },
) {
  const look = (ms: number) => opts.lookAt?.(ms) ?? ''
  const gradeClone = opts.gradeClone
  const boxH = opts.boxH ?? Math.round((opts.boxW * 9) / 16)
  const { W: exportW, H: exportH } = exportFrameSize(opts.boxW, boxH)
  const exW = opts.exportW ?? exportW
  const exH = opts.exportH ?? exportH
  let shaderNotice: string | null = null
  const main = mainFrame(edits, tb, outMs, opts.boxW, 1500, {
    suppressUpcomingPreRoll: Boolean(edits.templateProvenance?.v && !opts.playing),
  })
  setStyle(dom.mainKf, main.kf)
  const cutHost = dom.cloneA?.parentElement ?? null
  if (main.cut) {
    const c = main.cut
    syncClone(dom.cloneA, dom.mainLayer, c.aSrcMs, opts.mediaOffsetMs, opts.playing, opts.rate, look(c.aSrcMs), gradeClone, opts.sourceFrameAt, 'a', c.win.srcMs)
    syncClone(dom.cloneB, dom.mainLayer, c.bSrcMs, opts.mediaOffsetMs, opts.playing, opts.rate, look(c.bSrcMs), gradeClone, opts.sourceFrameAt, 'b', c.win.srcMs)
    if (c.pixel) {
      hideShaderCanvas(cutHost)
      drawPixelTransition(cutHost, dom.cloneA, dom.cloneB, c.pixel, opts.boxW, boxH, look(c.aSrcMs), look(c.bSrcMs))
      setStyle(dom.cloneA, { ...c.a, visibility: 'hidden' })
      setStyle(dom.cloneB, { ...c.b, visibility: 'hidden' })
    } else if (c.shader) {
      hidePixelCanvas(cutHost)
      const fail = drawShaderTransition(
        cutHost,
        dom.cloneA,
        dom.cloneB,
        c.shader,
        opts.boxW,
        boxH,
        exW,
        exH,
        look(c.aSrcMs),
        look(c.bSrcMs),
        gradeClone,
        c.aSrcMs,
        c.bSrcMs,
      )
      if (fail === null) {
        setStyle(dom.cloneA, { ...c.a, visibility: 'hidden' })
        setStyle(dom.cloneB, { ...c.b, visibility: 'hidden' })
        if (dom.cutDip && dom.cutDip.style.opacity !== '0') dom.cutDip.style.opacity = '0'
      } else if (fail !== null && fail !== 'not ready') {
        hideShaderCanvas(cutHost)
        setStyle(dom.cloneA, c.a)
        setStyle(dom.cloneB, c.b)
        if (fail !== 'CORS' || TransitionGL.corsOk(dom.cloneA?.querySelector('video') ?? document.createElement('video')) !== 'pending') {
          shaderNotice = shaderNoticeText(c.shader.type, fail === 'CORS' ? 'CORS' : fail)
        }
      } else {
        hideShaderCanvas(cutHost)
        setStyle(dom.cloneA, c.a)
        setStyle(dom.cloneB, c.b)
      }
    } else {
      hidePixelCanvas(cutHost)
      hideShaderCanvas(cutHost)
      setStyle(dom.cloneA, c.a)
      setStyle(dom.cloneB, c.b)
    }
    if (dom.cloneA && dom.cloneB) {
      const topA = c.top === 'a'
      dom.cloneA.style.zIndex = topA ? '2' : '0'
      dom.cloneB.style.zIndex = topA ? '0' : '2'
    }
    if (dom.cutDip) {
      dom.cutDip.style.background = c.color.background
      dom.cutDip.style.opacity = String(c.color.opacity)
    }
    if (dom.mainLayer && dom.mainLayer.style.visibility !== 'hidden') dom.mainLayer.style.visibility = 'hidden'
    if (dom.cloneA) dom.cloneA.dataset.active = 'true'
  } else {
    if (main.upcoming) {
      // Pre-seek both clones to the window start so they are decoded when it begins.
      syncClone(dom.cloneA, dom.mainLayer, main.upcoming.aSrcMs, opts.mediaOffsetMs, false, opts.rate, look(main.upcoming.aSrcMs), gradeClone, opts.sourceFrameAt, 'a', main.upcoming.win.srcMs)
      syncClone(dom.cloneB, dom.mainLayer, main.upcoming.bSrcMs, opts.mediaOffsetMs, false, opts.rate, look(main.upcoming.bSrcMs), gradeClone, opts.sourceFrameAt, 'b', main.upcoming.win.srcMs)
    } else {
      pauseClone(dom.cloneA)
      pauseClone(dom.cloneB)
    }
    hidePixelCanvas(cutHost)
    hideShaderCanvas(cutHost)
    setStyle(dom.cloneA, null)
    setStyle(dom.cloneB, null)
    if (dom.cutDip && dom.cutDip.style.opacity !== '0') dom.cutDip.style.opacity = '0'
    if (dom.mainLayer && dom.mainLayer.style.visibility === 'hidden') dom.mainLayer.style.visibility = ''
    if (dom.cloneA) delete dom.cloneA.dataset.active
  }

  const br = brollFrame(edits, outMs, opts.boxW)
  setStyle(dom.under, br.under)
  for (const [id, s] of Object.entries(br.items)) {
    setStyle(dom.brollBox[id] ?? null, s.box)
    const dip = dom.brollDip[id]
    if (dip) {
      dip.style.background = s.dip.background
      dip.style.opacity = String(s.dip.opacity)
    }
  }
  const hk = hookFrame(edits, outMs)
  setStyle(dom.hook, hk)
  opts.onShaderNotice?.(shaderNotice)
}
