export type ExportAspect = '9:16' | '1:1' | '16:9'
export type ExportResolution = '720p' | '1080p'

/** Output pixel size for export / ASS PlayRes. */
export function exportPixelSize(aspect: ExportAspect, resolution: ExportResolution): { width: number; height: number } {
  if (resolution === '1080p') {
    if (aspect === '1:1') return { width: 1080, height: 1080 }
    if (aspect === '16:9') return { width: 1920, height: 1080 }
    return { width: 1080, height: 1920 }
  }
  if (aspect === '1:1') return { width: 720, height: 720 }
  if (aspect === '16:9') return { width: 1280, height: 720 }
  return { width: 720, height: 1280 }
}

export function renderVersionHash(editsHash: string, aspect: ExportAspect, resolution: ExportResolution): string {
  return `${editsHash}:${aspect}:${resolution}`
}
