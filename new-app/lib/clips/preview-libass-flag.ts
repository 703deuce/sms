/**
 * EP2 flag `clipPreviewLibass` — the editor preview draws every text overlay with libass-wasm
 * (JASSUB) from the same .ass as the export. Default ON. Off switches:
 *   NEXT_PUBLIC_CLIP_PREVIEW_LIBASS=0 (deploy-wide) or localStorage.clipPreviewLibass = '0' (one browser).
 * When off, unsupported, or the WASM fails to load, the DOM overlays render as before.
 */
export const CLIP_PREVIEW_LIBASS_KEY = 'clipPreviewLibass'

export function previewLibassEnabled(): boolean {
  if (process.env.NEXT_PUBLIC_CLIP_PREVIEW_LIBASS === '0') return false
  try {
    if (globalThis.localStorage?.getItem(CLIP_PREVIEW_LIBASS_KEY) === '0') return false
  } catch {
    /* storage blocked: keep the default */
  }
  return true
}

/** Worker + OffscreenCanvas + WebAssembly (Chrome 69+, Safari 17+, Firefox 105+). */
export function libassSupported(): boolean {
  if (typeof window === 'undefined' || typeof document === 'undefined') return false
  if (typeof Worker === 'undefined' || typeof WebAssembly === 'undefined') return false
  if (typeof OffscreenCanvas === 'undefined') return false
  const proto = (globalThis as { HTMLCanvasElement?: { prototype: object } }).HTMLCanvasElement?.prototype
  return Boolean(proto && 'transferControlToOffscreen' in proto)
}
