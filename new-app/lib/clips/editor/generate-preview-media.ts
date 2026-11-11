import type { EditorMediaUrls } from '@/lib/server/clips/editor-clip-media'

export type GeneratePreview = { url: string; offsetMs: number; kind: 'segment' | 'source' | 'proxy' | 'composite'; minMs?: number; maxMs?: number }

/** UI-only candidates. NEVER use these for provider source-video edit requests. */
export function generatePreviewCandidates(args: {
  authorizedSegment: { url: string; offsetMs: number } | null
  authorizedSource: { url: string; offsetMs: number } | null
  urls: EditorMediaUrls
  segmentStartMs: number | null
  segmentEndMs: number | null
  clipStartMs: number
  clipEndMs: number
}): GeneratePreview[] {
  const candidates: GeneratePreview[] = []
  const add = (candidate: GeneratePreview | null) => {
    if (candidate?.url && !candidates.some((other) => other.url === candidate.url)) candidates.push(candidate)
  }
  add(args.authorizedSegment ? { ...args.authorizedSegment, kind: 'segment' } : null)
  add(args.authorizedSource ? { ...args.authorizedSource, kind: 'source' } : null)
  add(args.urls.segment && args.segmentStartMs != null ? {
    url: args.urls.segment, kind: 'segment', offsetMs: args.segmentStartMs,
    minMs: args.segmentStartMs, maxMs: args.segmentEndMs ?? undefined,
  } : null)
  add(args.urls.source ? { url: args.urls.source, kind: 'source', offsetMs: 0 } : null)
  add(args.urls.proxy ? { url: args.urls.proxy, kind: 'proxy', offsetMs: 0 } : null)
  add(args.urls.preview ? {
    url: args.urls.preview, kind: 'composite', offsetMs: args.clipStartMs,
    minMs: args.clipStartMs, maxMs: args.clipEndMs,
  } : null)
  return candidates
}

export function clampGeneratePreviewSeek(sourceMs: number, preview: GeneratePreview | null, durationSeconds: number): number {
  if (!preview) return 0
  const requested = Math.max(0, (sourceMs - preview.offsetMs) / 1000)
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) return requested
  return Math.min(requested, Math.max(0, durationSeconds - 0.05))
}
