import { exportPixelSize, parseExportAspect, type ExportResolution } from '@/lib/clips/export-aspect'
import { normalizeEdits, type ClipBounds } from '@/lib/clips/edits'
import { clipEditsToNleTimelineSegments } from '@/lib/clips/export-nle-timeline'

export type FcpxmlSegment = {
  /** Timeline offset in seconds from sequence start (export/display time). */
  offsetSec: number
  /** In-point in source media, seconds. */
  sourceStartSec: number
  /** Duration on the sequence timeline, seconds. */
  durationSec: number
  /** Source media span referenced by this clip, seconds. */
  sourceDurationSec: number
  /** Constant speed for this span (1 = normal). */
  speed: number
}

export type ClipFcpxmlInput = {
  title: string
  sourceMediaHref: string
  /** Display / relink name in FCPXML asset (defaults to title). */
  sourceMediaName?: string
  /** Absolute source media duration (seconds) when known. */
  sourceDurationSec: number
  segments: FcpxmlSegment[]
  fps?: number
  width?: number
  height?: number
}

const DEFAULT_FPS = 30

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

export function fcpxTimeSeconds(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return '0s'
  const rounded = Math.round(sec * 1_000_000) / 1_000_000
  return `${rounded}s`
}

export function msToFcpxSeconds(ms: number): number {
  return Math.max(0, ms) / 1000
}

export function clipEditsToFcpxmlSegments(edits: unknown, bounds: ClipBounds) {
  return clipEditsToNleTimelineSegments(normalizeEdits(edits, bounds), bounds)
}

export function buildClipTimelineFcpxml(input: ClipFcpxmlInput): string {
  const fps = input.fps && input.fps > 0 ? input.fps : DEFAULT_FPS
  const width = input.width && input.width > 0 ? input.width : 1080
  const height = input.height && input.height > 0 ? input.height : 1920
  const frameDuration = `100/${fps * 100}s`
  const formatName = `FFVideoFormat${height}p${fps}`
  const title = escapeXml(input.title.trim() || 'Transovo clip')
  const assetName = escapeXml(input.sourceMediaName?.trim() || input.title.trim() || 'Transovo clip')
  const src = escapeXml(input.sourceMediaHref)
  const sourceDuration = fcpxTimeSeconds(input.sourceDurationSec)
  const sequenceDuration = fcpxTimeSeconds(
    Math.max(
      input.segments.reduce((max, s) => Math.max(max, s.offsetSec + s.durationSec), 0),
      input.segments.length ? 0 : input.sourceDurationSec,
    ) || input.sourceDurationSec,
  )

  const spineClips = input.segments
    .map((seg, i) => {
      const speed = seg.speed && Math.abs(seg.speed - 1) > 0.001 ? seg.speed : 1
      const timeMap =
        speed !== 1
          ? `\n              <timeMap>\n                <timept time="0s" value="0s" interp="linear"/>\n                <timept time="${fcpxTimeSeconds(seg.durationSec)}" value="${fcpxTimeSeconds(seg.sourceDurationSec)}" interp="linear"/>\n              </timeMap>`
          : ''
      return `            <asset-clip name="${title} ${i + 1}" ref="r2" offset="${fcpxTimeSeconds(seg.offsetSec)}" start="${fcpxTimeSeconds(seg.sourceStartSec)}" duration="${fcpxTimeSeconds(seg.durationSec)}">${timeMap}\n            </asset-clip>`
    })
    .join('\n')

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE fcpxml>
<fcpxml version="1.10">
  <resources>
    <format id="r1" name="${formatName}" frameDuration="${frameDuration}" width="${width}" height="${height}" />
    <asset id="r2" name="${assetName}" uid="${escapeXml(input.title)}" src="${src}" start="0s" duration="${sourceDuration}" hasVideo="1" hasAudio="1" format="r1" />
  </resources>
  <library>
    <event name="Transovo Export">
      <project name="${title}">
        <sequence format="r1" duration="${sequenceDuration}" tcStart="0s" tcFormat="NDF">
          <spine>
${spineClips || `            <asset-clip name="${title}" ref="r2" offset="0s" start="0s" duration="${sequenceDuration}" />`}
          </spine>
        </sequence>
      </project>
    </event>
  </library>
</fcpxml>
`
}

export function buildFcpxmlFromClipEdits(opts: {
  title: string
  clipStartMs: number
  clipEndMs: number
  edits: unknown
  bounds: ClipBounds
  sourceMediaHref: string
  /** Basename for FCPXML asset @name (defaults to title). */
  sourceMediaFilename?: string
  sourceDurationMs?: number
  fps?: number
  aspect?: string
  resolution?: ExportResolution
}): string {
  const bounds = opts.bounds
  const edits = normalizeEdits(opts.edits, bounds)
  const { segments, timelineDurationSec } = clipEditsToFcpxmlSegments(edits, bounds)
  const aspect = parseExportAspect(opts.aspect ?? edits.aspectRatio ?? '9:16') ?? '9:16'
  const resolution = opts.resolution ?? '1080p'
  const { width, height } = exportPixelSize(aspect, resolution)
  const sourceDurationSec =
    opts.sourceDurationMs != null && Number.isFinite(opts.sourceDurationMs)
      ? msToFcpxSeconds(opts.sourceDurationMs)
      : Math.max(timelineDurationSec, msToFcpxSeconds(opts.clipEndMs - opts.clipStartMs))

  return buildClipTimelineFcpxml({
    title: opts.title,
    sourceMediaHref: opts.sourceMediaHref,
    sourceMediaName: opts.sourceMediaFilename,
    sourceDurationSec,
    segments,
    fps: opts.fps,
    width,
    height,
  })
}

export function fcpxmlDownloadFilename(title: string): string {
  const base = title
    .trim()
    .replace(/[^\w\s-]+/g, '')
    .replace(/\s+/g, '-')
    .slice(0, 80)
  return `${base || 'clip'}.fcpxml`
}
