export const EXPORT_ASPECT_PRESETS = ['9:16', '4:5', '1:1', '16:9', '4:3', '21:9'] as const
export type PresetAspect = (typeof EXPORT_ASPECT_PRESETS)[number]
export type CustomAspect = `custom:${number}x${number}`
export type ExportAspect = PresetAspect | CustomAspect
export type ExportResolution = '720p' | '1080p' | '1440p' | '2160p'

export const CUSTOM_ASPECT_MIN = 240
export const CUSTOM_ASPECT_MAX = 3840
export const CUSTOM_ASPECT_MAX_RATIO = 4

/** Bump when ffmpeg audio mix / duck / fade behavior changes (invalidates cached exports). */
export const CLIP_AUDIO_RENDER_REV = 'au33-v1'

/** Worker deploy SHA (12 chars) — set CLIPS_WORKER_GIT_SHA on web + worker so cache keys match. */
export function clipsWorkerGitShaForRenderCache(): string {
  const raw = process.env.CLIPS_WORKER_GIT_SHA?.trim()
  if (!raw || raw === 'unknown') return 'unknown'
  return raw.slice(0, 12)
}

/** Bump when export compositor / worker render behavior changes (invalidates READY render reuse). */
export const CLIP_RENDER_PIPELINE_REV = `t48-${CLIP_AUDIO_RENDER_REV}-${clipsWorkerGitShaForRenderCache()}`

const PRESET_PARTS: Record<PresetAspect, [number, number]> = {
  '9:16': [9, 16],
  '4:5': [4, 5],
  '1:1': [1, 1],
  '16:9': [16, 9],
  '4:3': [4, 3],
  '21:9': [21, 9],
}

const even = (n: number) => n - (n % 2)

function ratioOk(w: number, h: number): boolean {
  if (w <= 0 || h <= 0) return false
  const r = w / h
  return r >= 1 / CUSTOM_ASPECT_MAX_RATIO && r <= CUSTOM_ASPECT_MAX_RATIO
}

export function customAspectToken(w: number, h: number): CustomAspect | undefined {
  let W = even(Math.floor(w))
  let H = even(Math.floor(h))
  W = Math.min(CUSTOM_ASPECT_MAX, Math.max(CUSTOM_ASPECT_MIN, W))
  H = Math.min(CUSTOM_ASPECT_MAX, Math.max(CUSTOM_ASPECT_MIN, H))
  if (!ratioOk(W, H)) return undefined
  return `custom:${W}x${H}` as CustomAspect
}

export function parseExportAspect(raw: unknown): ExportAspect | undefined {
  if (typeof raw !== 'string') return undefined
  const s = raw.trim()
  if ((EXPORT_ASPECT_PRESETS as readonly string[]).includes(s)) return s as PresetAspect
  const m = /^custom:(\d{1,5})x(\d{1,5})$/.exec(s)
  if (!m) return undefined
  return customAspectToken(Number(m[1]), Number(m[2]))
}

export function isCustomAspect(a: ExportAspect | undefined): a is CustomAspect {
  return typeof a === 'string' && a.startsWith('custom:')
}

export function customAspectDims(a: CustomAspect): { width: number; height: number } {
  const m = /^custom:(\d+)x(\d+)$/.exec(a)
  if (!m) return { width: 240, height: 240 }
  return { width: Number(m[1]), height: Number(m[2]) }
}

/** aw/ah as numbers; unknown or undefined → 9:16 (same fallback as today). */
export function aspectRatioParts(a: ExportAspect | undefined): { aw: number; ah: number } {
  const token = a ?? '9:16'
  if (isCustomAspect(token)) {
    const { width, height } = customAspectDims(token)
    return { aw: width, ah: height }
  }
  const preset = parseExportAspect(token)
  if (preset && !isCustomAspect(preset)) {
    const [aw, ah] = PRESET_PARTS[preset as PresetAspect]
    return { aw, ah }
  }
  return { aw: 9, ah: 16 }
}

export function aspectCss(a: ExportAspect | undefined): string {
  const { aw, ah } = aspectRatioParts(a)
  return `${aw} / ${ah}`
}

export function isLandscapeAspect(a: ExportAspect | undefined): boolean {
  const { aw, ah } = aspectRatioParts(a)
  return aw > ah
}

export function aspectLabel(a: ExportAspect): string {
  if (isCustomAspect(a)) {
    const { width, height } = customAspectDims(a)
    return `Custom ${width}×${height}`
  }
  return a
}

function pixelSizeFromParts(aw: number, ah: number, short: number): { width: number; height: number } {
  let w: number
  let h: number
  if (aw >= ah) {
    w = Math.round(short * (aw / ah))
    h = short
  } else {
    w = short
    h = Math.round(short * (ah / aw))
  }
  w = even(w)
  h = even(h)
  const maxDim = Math.max(w, h)
  if (maxDim > CUSTOM_ASPECT_MAX) {
    const scale = CUSTOM_ASPECT_MAX / maxDim
    w = even(Math.floor(w * scale))
    h = even(Math.floor(h * scale))
  }
  return { width: w, height: h }
}

/** Output pixel size for export / ASS PlayRes. */
export function exportPixelSize(aspect: ExportAspect, resolution: ExportResolution): { width: number; height: number } {
  const short =
    resolution === '2160p' || resolution === '1440p' ? 1080 : resolution === '1080p' ? 1080 : 720
  if (isCustomAspect(aspect)) {
    const { width, height } = customAspectDims(aspect)
    return pixelSizeFromParts(width, height, short)
  }
  const preset = parseExportAspect(aspect)
  if (preset && !isCustomAspect(preset)) {
    const [aw, ah] = PRESET_PARTS[preset as PresetAspect]
    return pixelSizeFromParts(aw, ah, short)
  }
  return pixelSizeFromParts(9, 16, short)
}

export function renderVersionHash(editsHash: string, aspect: ExportAspect, resolution: ExportResolution): string {
  return `${CLIP_RENDER_PIPELINE_REV}:${editsHash}:${aspect}:${resolution}`
}
