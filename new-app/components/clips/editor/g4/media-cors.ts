/**
 * G4afix: CORS-mode media in the editor, so the WebGL grade mirror (grade-gl.ts), scopes / Auto
 * (frame-grab.ts) and the filmstrip can read pixels of the main video, proxies, uploads and B-roll.
 *
 * Every cross-origin <video> / <img> under the preview gets crossOrigin="anonymous" BEFORE its
 * first fetch (PreviewStage runs `prepareMediaCors` in a layout effect, i.e. before the media
 * element's async resource fetch starts, and a MutationObserver catches imperative src changes).
 * Loading everything in CORS mode from the start also stops the browser from reusing a cached
 * no-CORS response for a later CORS request of the same URL (the old cause of the "does not allow
 * pixel access" notice and of the filmstrip's console CORS errors).
 *
 * Graceful fallback: when a CORS load fails (host sends no Access-Control-Allow-Origin), the
 * element is reloaded WITHOUT crossOrigin (time / play state kept) and the URL is remembered as
 * no-CORS, so playback never breaks; the grade preview then says why the 3D stage is off.
 */
import { corsKnown, markCorsOk, markNoCors } from './grade-gl'

type Media = HTMLVideoElement | HTMLImageElement

export function isCrossOriginUrl(url: string): boolean {
  if (!url || url.startsWith('blob:') || url.startsWith('data:') || url.startsWith('/')) return false
  if (typeof location === 'undefined') return false
  try {
    const u = new URL(url, location.href)
    return (u.protocol === 'https:' || u.protocol === 'http:') && u.origin !== location.origin
  } catch {
    return false
  }
}

function srcOf(el: Media): string {
  return el.getAttribute('src') || ''
}

/** Re-run the media load keeping the playhead / play state. */
function reload(el: Media) {
  if (el instanceof HTMLVideoElement) {
    const t = el.currentTime
    const playing = !el.paused
    el.load()
    if (t > 0 || playing) {
      el.addEventListener(
        'loadedmetadata',
        () => {
          try {
            el.currentTime = t
          } catch {
            /* ignore */
          }
          if (playing) void el.play().catch(() => {})
        },
        { once: true },
      )
    }
  } else {
    // A crossorigin attribute change already restarts an <img> load; re-set src for older engines.
    const s = el.getAttribute('src')
    if (s) el.setAttribute('src', s)
  }
}

/** Put one element in CORS mode (no-op for same-origin / known no-CORS URLs). */
export function prepareMediaCors(el: Media) {
  const url = srcOf(el)
  if (!url || el.dataset.g4corsOff === url || !isCrossOriginUrl(url)) return
  if (corsKnown(url) === 'no') return
  if (el.crossOrigin === 'anonymous') {
    el.dataset.g4cors = url
    return
  }
  // Already fetching without CORS (src set outside a React commit): restart in CORS mode.
  const started = el instanceof HTMLVideoElement ? el.networkState === HTMLMediaElement.NETWORK_LOADING || el.readyState > 0 : false
  el.crossOrigin = 'anonymous'
  el.dataset.g4cors = url
  if (started) reload(el)
}

/** Load error of a CORS-mode element → drop crossOrigin, reload plain, remember the URL. */
export function onMediaCorsError(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLVideoElement || el instanceof HTMLImageElement)) return false
  const url = srcOf(el)
  if (!url || el.dataset.g4cors !== url || el.crossOrigin !== 'anonymous') return false
  markNoCors(url)
  delete el.dataset.g4cors
  el.dataset.g4corsOff = url
  el.removeAttribute('crossorigin')
  reload(el)
  return true
}

/** A CORS-mode element that loaded fine proves the host allows pixel access (skips the probe). */
export function noteMediaLoaded(el: EventTarget | null) {
  if (!(el instanceof HTMLVideoElement || el instanceof HTMLImageElement)) return
  const url = srcOf(el)
  if (url && el.crossOrigin === 'anonymous' && el.dataset.g4cors === url) markCorsOk(url)
}

export function prepareAll(root: ParentNode | null) {
  root?.querySelectorAll<Media>('video, img').forEach(prepareMediaCors)
}

/**
 * Watch `root`: new / re-pointed media get CORS mode, load errors fall back, successful loads
 * mark the URL pixel-readable. Returns the cleanup.
 */
export function watchMediaCors(root: HTMLElement | null): () => void {
  if (!root || typeof MutationObserver === 'undefined') return () => {}
  prepareAll(root)
  const mo = new MutationObserver((recs) => {
    for (const r of recs) {
      if (r.type === 'attributes' && (r.target instanceof HTMLVideoElement || r.target instanceof HTMLImageElement)) prepareMediaCors(r.target)
      r.addedNodes.forEach((n) => {
        if (n instanceof HTMLVideoElement || n instanceof HTMLImageElement) prepareMediaCors(n)
        else if (n instanceof HTMLElement) prepareAll(n)
      })
    }
  })
  mo.observe(root, { subtree: true, childList: true, attributes: true, attributeFilter: ['src'] })
  const onErr = (e: Event) => void onMediaCorsError(e.target)
  const onOk = (e: Event) => noteMediaLoaded(e.target)
  root.addEventListener('error', onErr, true)
  root.addEventListener('loadeddata', onOk, true)
  root.addEventListener('load', onOk, true)
  return () => {
    mo.disconnect()
    root.removeEventListener('error', onErr, true)
    root.removeEventListener('loadeddata', onOk, true)
    root.removeEventListener('load', onOk, true)
  }
}

/** JSX props for thumbnails outside the preview (panels): CORS mode with the same fallback. */
export function corsMediaProps(url: string | null | undefined): { crossOrigin?: 'anonymous'; onError?: (e: { currentTarget: EventTarget }) => void } {
  if (!url || !isCrossOriginUrl(url) || corsKnown(url) === 'no') return {}
  return { crossOrigin: 'anonymous', onError: (e) => void onMediaCorsError(e.currentTarget) }
}

/** Imperative src assignment with CORS mode set first (insert playback, blur copies). */
export function setMediaSrc(el: Media, url: string) {
  if (isCrossOriginUrl(url) && corsKnown(url) !== 'no' && el.dataset.g4corsOff !== url) {
    el.crossOrigin = 'anonymous'
    el.dataset.g4cors = url
  } else if (el.crossOrigin) {
    el.removeAttribute('crossorigin')
    delete el.dataset.g4cors
  }
  el.src = url
}

/**
 * G4cfix: may this element feed Web Audio (createMediaElementSource)? A cross-origin source that
 * did not load in CORS mode makes the node output silence ("MediaElementAudioSource outputs zeroes
 * due to CORS access restrictions") — so the voice graph is only built for same-origin media or a
 * CORS-mode element whose URL is not known to lack CORS headers; otherwise it plays plain.
 */
export function audioGraphSafe(el: HTMLMediaElement): boolean {
  const url = el.currentSrc || el.getAttribute('src') || ''
  if (!url || !isCrossOriginUrl(url)) return true
  if (el.crossOrigin !== 'anonymous' || el.dataset.g4corsOff === url) return false
  return corsKnown(url) !== 'no'
}
