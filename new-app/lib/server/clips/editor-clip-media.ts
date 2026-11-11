import type { EditorMedia } from '@/lib/server/clips/clip-detail'

export type EditorMediaUrls = {
  preview: string | null
  poster: string | null
  proxy: string | null
  source: string | null
  segment: string | null
}

/** Same-origin editor poster URL so poster image loads never depend on bucket CORS. */
export function editorPosterUrl(clipId: string, posterKey: string | null | undefined): string | null {
  if (!posterKey) return null
  return `/api/clips/clips/${encodeURIComponent(clipId)}/poster`
}

export function streamerPrefersClipSegmentMedia(opts: {
  hasStreamVod: boolean
  bulkyStoragePurged: boolean
  proxyKey: string | null
  sourceSegKey: string | null
}): boolean {
  if (opts.hasStreamVod || opts.bulkyStoragePurged) return Boolean(opts.sourceSegKey)
  if (!opts.proxyKey && opts.sourceSegKey) return true
  return false
}

/** Editor playback: proxy → source (if present) → clip segment → preview composite. */
export function resolveEditorClipMedia(args: {
  proxyKey: string | null
  signedProxy: string | null
  sourceKey: string | null
  signedSource: string | null
  uploadSourcePresent: boolean
  preferClipSegment: boolean
  segmentExists: boolean
  signedSourceSeg: string | null
  sourceSegStartMs: number | null
  sourceSegEndMs: number | null
  previewKey: string | null
  signedPreview: string | null
  clipStartMs: number
  clipEndMs: number
}): EditorMedia | null {
  const segmentMedia = (): EditorMedia | null => {
    if (!args.segmentExists || !args.signedSourceSeg || args.sourceSegStartMs == null) return null
    return {
      url: args.signedSourceSeg,
      kind: 'segment',
      offsetMs: args.sourceSegStartMs,
      minMs: args.sourceSegStartMs,
      maxMs: args.sourceSegEndMs ?? undefined,
    }
  }

  if (args.proxyKey && args.signedProxy) {
    return { url: args.signedProxy, kind: 'proxy', offsetMs: 0 }
  }

  if (args.preferClipSegment) {
    const seg = segmentMedia()
    if (seg) return seg
  }

  if (args.sourceKey && args.signedSource && args.uploadSourcePresent) {
    return { url: args.signedSource, kind: 'source', offsetMs: 0 }
  }

  const seg = segmentMedia()
  if (seg) return seg

  if (args.previewKey && args.signedPreview) {
    return {
      url: args.signedPreview,
      kind: 'composite',
      offsetMs: args.clipStartMs,
      minMs: args.clipStartMs,
      maxMs: args.clipEndMs,
    }
  }

  return null
}

/** Ordered fallbacks after primary media fails to load (404 / network). */
export function editorMediaLoadFallbacks(
  primary: EditorMedia | null,
  urls: EditorMediaUrls,
  opts: {
    sourceSegStartMs: number | null
    sourceSegEndMs: number | null
    clipStartMs: number
    clipEndMs: number
  },
): EditorMedia[] {
  const out: EditorMedia[] = []
  const push = (m: EditorMedia | null) => {
    if (!m?.url) return
    if (out.some((x) => x.url === m.url)) return
    out.push(m)
  }

  const segment: EditorMedia | null =
    urls.segment && opts.sourceSegStartMs != null
      ? {
          url: urls.segment,
          kind: 'segment',
          offsetMs: opts.sourceSegStartMs,
          minMs: opts.sourceSegStartMs,
          maxMs: opts.sourceSegEndMs ?? undefined,
        }
      : null

  if (primary?.kind === 'source') {
    push(segment)
    if (urls.preview) {
      push({
        url: urls.preview,
        kind: 'composite',
        offsetMs: opts.clipStartMs,
        minMs: opts.clipStartMs,
        maxMs: opts.clipEndMs,
      })
    }
    return out
  }

  if (primary?.kind === 'proxy') {
    push(segment)
    if (urls.source) push({ url: urls.source, kind: 'source', offsetMs: 0 })
    if (urls.preview) {
      push({
        url: urls.preview,
        kind: 'composite',
        offsetMs: opts.clipStartMs,
        minMs: opts.clipStartMs,
        maxMs: opts.clipEndMs,
      })
    }
    return out
  }

  return out
}
