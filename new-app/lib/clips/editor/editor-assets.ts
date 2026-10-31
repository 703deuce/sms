/**
 * FV2 editor assets (pure; no React). Full-video projects get a worker-made compact peaks file and
 * a filmstrip sprite (see worker/clips_worker/full_video_assets.py). Clips get neither — their
 * waveform still decodes the media and their filmstrip is extracted client-side (no B2 files).
 */

export type FilmstripSprite = {
  intervalMs: number
  tileW: number
  tileH: number
  cols: number
  rows: number
  count: number
  sheetUrls: string[]
}

export type EditorAssets = {
  fullVideo: boolean
  peaksUrl: string | null
  filmstrip: FilmstripSprite | null
}

export type PeaksFile = { v: 1; peaksPerSec: number; durationMs: number; format: 'u8b64'; data: string }

/** Raw aiMeta.editorAssets (worker) → keys to sign. Tolerates junk. */
export function editorAssetKeys(aiMeta: unknown): {
  fullVideo: boolean
  peaksKey: string | null
  filmstrip: (Omit<FilmstripSprite, 'sheetUrls'> & { keys: string[] }) | null
} {
  const m = (aiMeta && typeof aiMeta === 'object' ? aiMeta : {}) as Record<string, unknown>
  const a = (m.editorAssets && typeof m.editorAssets === 'object' ? m.editorAssets : {}) as Record<string, unknown>
  const peaksKey = typeof a.peaksKey === 'string' && a.peaksKey ? a.peaksKey : null
  const f = (a.filmstrip && typeof a.filmstrip === 'object' ? a.filmstrip : null) as Record<string, unknown> | null
  const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : 0)
  let filmstrip: ReturnType<typeof editorAssetKeys>['filmstrip'] = null
  if (f) {
    const keys = Array.isArray(f.keys) ? f.keys.filter((k): k is string => typeof k === 'string' && k.length > 0) : []
    const s = {
      intervalMs: num(f.intervalMs),
      tileW: num(f.tileW),
      tileH: num(f.tileH),
      cols: num(f.cols),
      rows: num(f.rows),
      count: num(f.count),
      keys,
    }
    if (keys.length && s.intervalMs && s.tileW && s.tileH && s.cols && s.rows && s.count) filmstrip = s
  }
  return { fullVideo: m.fullVideo === true, peaksKey, filmstrip }
}

/** Decode the u8/base64 peaks file into 0..1 values. */
export function decodePeaksFile(file: unknown): { peaks: number[]; peaksPerSec: number; durationMs: number } | null {
  const f = file as Partial<PeaksFile> | null
  if (!f || f.v !== 1 || f.format !== 'u8b64' || typeof f.data !== 'string' || !(Number(f.peaksPerSec) > 0)) return null
  let bin: string
  try {
    bin = typeof atob === 'function' ? atob(f.data) : Buffer.from(f.data, 'base64').toString('binary')
  } catch {
    return null
  }
  const peaks = new Array<number>(bin.length)
  for (let i = 0; i < bin.length; i++) peaks[i] = bin.charCodeAt(i) / 255
  return { peaks, peaksPerSec: Number(f.peaksPerSec), durationMs: Number(f.durationMs) || 0 }
}

/** Sprite tile for media time `ms`: which sheet + the tile's pixel offset inside it. */
export function spriteTileAt(s: FilmstripSprite, ms: number): { sheet: number; x: number; y: number; index: number } | null {
  if (!s.sheetUrls.length || s.count <= 0) return null
  const per = s.cols * s.rows
  const idx = Math.max(0, Math.min(s.count - 1, Math.floor(Math.max(0, ms) / s.intervalMs)))
  const sheet = Math.floor(idx / per)
  if (sheet >= s.sheetUrls.length) return null
  const k = idx % per
  return { sheet, x: (k % s.cols) * s.tileW, y: Math.floor(k / s.cols) * s.tileH, index: idx }
}

/**
 * Filmstrip tiles for one lane item: media range [fromMs, toMs) drawn over `widthPx` at `tileW`
 * on-screen px per thumb; only tiles intersecting the visible window [visLeftPx, visRightPx) of the
 * item are returned (virtualized). Each tile's media time is its centre — denser when zoomed in.
 */
export function filmstripTiles(opts: {
  fromMs: number
  toMs: number
  widthPx: number
  tileW: number
  visLeftPx?: number
  visRightPx?: number
  maxTiles?: number
}): Array<{ leftPx: number; widthPx: number; mediaMs: number }> {
  const { fromMs, toMs, widthPx, tileW } = opts
  if (!(widthPx > 0) || !(tileW > 0) || !(toMs > fromMs)) return []
  const msPerPx = (toMs - fromMs) / widthPx
  const n = Math.ceil(widthPx / tileW)
  const lo = Math.max(0, Math.floor((opts.visLeftPx ?? 0) / tileW))
  const hi = Math.min(n, Math.ceil((opts.visRightPx ?? widthPx) / tileW))
  const max = opts.maxTiles ?? 400
  const out: Array<{ leftPx: number; widthPx: number; mediaMs: number }> = []
  for (let i = lo; i < hi && out.length < max; i++) {
    const left = i * tileW
    const w = Math.min(tileW, widthPx - left)
    out.push({ leftPx: left, widthPx: w, mediaMs: fromMs + (left + w / 2) * msPerPx })
  }
  return out
}

/** Quantum for client-side frame extraction at this zoom: one frame per on-screen tile, >= 250 ms. */
export function clientFrameQuantumMs(pxPerMs: number, tileW: number, minMs = 250): number {
  if (!(pxPerMs > 0)) return 1000
  const raw = tileW / pxPerMs
  const steps = [250, 500, 1000, 2000, 5000, 10000, 30000, 60000]
  for (const s of steps) if (s >= Math.max(minMs, raw)) return s
  return 60000
}
