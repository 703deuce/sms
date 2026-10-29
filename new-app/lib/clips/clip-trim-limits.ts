/** Authoritative trim window for clip editor + server normalize (Part F). */

export type ClipTrimLimitInput = {
  startMs: number
  endMs: number
  sourceSegKey?: string | null
  sourceSegStartMs?: number | null
  sourceSegEndMs?: number | null
  previewKey?: string | null
}

export type ClipTrimLimits = { trimMinMs: number; trimMaxMs: number }

export function clipTrimLimits(
  clip: ClipTrimLimitInput,
  uploadDurationMs: number | null,
  hasUploadOrProxy: boolean,
): ClipTrimLimits | undefined {
  const segStart = clip.sourceSegStartMs
  const segEnd = clip.sourceSegEndMs
  if (clip.sourceSegKey && segStart != null && segEnd != null && segEnd > segStart) {
    return { trimMinMs: segStart, trimMaxMs: segEnd }
  }
  const preview = clip.previewKey ?? ''
  if (preview.includes('_composite') || preview.endsWith('/composite.mp4')) {
    return { trimMinMs: clip.startMs, trimMaxMs: clip.endMs }
  }
  if (hasUploadOrProxy) {
    const hi = uploadDurationMs != null && uploadDurationMs > 0 ? uploadDurationMs : clip.endMs + 8000
    return { trimMinMs: 0, trimMaxMs: hi }
  }
  return undefined
}
