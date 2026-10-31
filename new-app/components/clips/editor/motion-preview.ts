/**
 * E3 preview controller: applies lib/clips/editor/motion-frame.ts styles to the preview DOM on
 * every rAF tick of PreviewStage. Cut transitions use two muted clones of the main layer
 * (A = outgoing clip continued past the cut, B = incoming clip started before it), exactly the
 * handle frames the export's xfade uses; the real main layer keeps playing (audio, clock) hidden.
 */
import type { ClipEditsV2 } from '@/lib/clips/edits'
import { videoTimeFromSourceMs } from '@/lib/clips/editor-playback'
import { brollFrame, hookFrame, mainFrame, type FrameStyle } from '@/lib/clips/editor/motion-frame'
import type { LayerCss } from '@/lib/clips/editor/transitions'

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
}

/** Deep-clone the main layer once per layout (muted, no test ids, no autoplay). */
function ensureClone(host: HTMLElement | null, main: HTMLElement | null): HTMLVideoElement[] {
  if (!host || !main) return []
  const sig = `${main.childElementCount}:${main.querySelector('video')?.getAttribute('src') ?? ''}:${main.firstElementChild?.className ?? ''}`
  if (host.dataset.sig !== sig) {
    const copy = main.cloneNode(true) as HTMLElement
    copy.removeAttribute('data-testid')
    copy.querySelectorAll('[data-testid]').forEach((n) => n.removeAttribute('data-testid'))
    copy.style.visibility = 'visible'
    copy.style.transform = ''
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

function syncClone(
  host: HTMLElement | null,
  main: HTMLElement | null,
  srcMs: number,
  mediaOffsetMs: number,
  playing: boolean,
  rate: number,
) {
  const vids = ensureClone(host, main)
  const mains = main ? Array.from(main.querySelectorAll('video')) : []
  const t = videoTimeFromSourceMs(srcMs, mediaOffsetMs)
  vids.forEach((v, i) => {
    const m = mains[i]
    // Per-tick crop transforms (speaker-follow) are inline styles on the main videos.
    if (m && v.style.cssText !== m.style.cssText) v.style.cssText = m.style.cssText
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
}

function pauseClone(host: HTMLElement | null) {
  host?.querySelectorAll('video').forEach((v) => {
    if (!v.paused) v.pause()
  })
}

export function applyMotionFrame(
  dom: MotionDom,
  edits: ClipEditsV2,
  tb: { segs: [number, number][]; starts: number[] },
  outMs: number,
  opts: { boxW: number; playing: boolean; rate: number; mediaOffsetMs: number },
) {
  const main = mainFrame(edits, tb, outMs, opts.boxW)
  setStyle(dom.mainKf, main.kf)
  if (main.cut) {
    const c = main.cut
    syncClone(dom.cloneA, dom.mainLayer, c.aSrcMs, opts.mediaOffsetMs, opts.playing, opts.rate)
    syncClone(dom.cloneB, dom.mainLayer, c.bSrcMs, opts.mediaOffsetMs, opts.playing, opts.rate)
    setStyle(dom.cloneA, c.a)
    setStyle(dom.cloneB, c.b)
    if (dom.cutDip) {
      dom.cutDip.style.background = c.color.background
      dom.cutDip.style.opacity = String(c.color.opacity)
    }
    if (dom.mainLayer && dom.mainLayer.style.visibility !== 'hidden') dom.mainLayer.style.visibility = 'hidden'
    if (dom.cloneA) dom.cloneA.dataset.active = 'true'
  } else {
    if (main.upcoming) {
      // Pre-seek both clones to the window start so they are decoded when it begins.
      syncClone(dom.cloneA, dom.mainLayer, main.upcoming.aSrcMs, opts.mediaOffsetMs, false, opts.rate)
      syncClone(dom.cloneB, dom.mainLayer, main.upcoming.bSrcMs, opts.mediaOffsetMs, false, opts.rate)
    } else {
      pauseClone(dom.cloneA)
      pauseClone(dom.cloneB)
    }
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
}
