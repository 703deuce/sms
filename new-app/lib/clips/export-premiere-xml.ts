import {
  clipEditsToFcpxmlSegments,
  msToFcpxSeconds,
  type FcpxmlSegment,
} from '@/lib/clips/export-xml'
import { exportPixelSize, parseExportAspect, type ExportResolution } from '@/lib/clips/export-aspect'
import { normalizeEdits, type ClipBounds } from '@/lib/clips/edits'

const DEFAULT_FPS = 30

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function secToFrames(sec: number, fps: number): number {
  return Math.max(0, Math.round(sec * fps))
}

function clipItemsXml(
  segments: FcpxmlSegment[],
  title: string,
  sourceMediaFilename: string,
  pathUrl: string,
  fps: number,
): string {
  const fileId = 'file-1'
  const fileBlock = `          <file id="${fileId}">
            <name>${escapeXml(sourceMediaFilename)}</name>
            <pathurl>${escapeXml(pathUrl)}</pathurl>
            <rate>
              <timebase>${fps}</timebase>
              <ntsc>FALSE</ntsc>
            </rate>
          </file>`
  const items = segments
    .map((seg, i) => {
      const durFrames = secToFrames(seg.durationSec, fps)
      const startFrames = secToFrames(seg.offsetSec, fps)
      const inFrames = secToFrames(seg.sourceStartSec, fps)
      const endFrames = startFrames + durFrames
      const outFrames = inFrames + durFrames
      return `          <clipitem id="clipitem-${i + 1}">
            <name>${escapeXml(title)} ${i + 1}</name>
            <duration>${durFrames}</duration>
            <rate>
              <timebase>${fps}</timebase>
              <ntsc>FALSE</ntsc>
            </rate>
            <start>${startFrames}</start>
            <end>${endFrames}</end>
            <in>${inFrames}</in>
            <out>${outFrames}</out>
            <file id="${fileId}"/>
          </clipitem>`
    })
    .join('\n')
  return `${fileBlock}\n${items}`
}

export function buildPremiereXmlFromClipEdits(opts: {
  title: string
  clipStartMs: number
  clipEndMs: number
  edits: unknown
  bounds: ClipBounds
  sourceMediaFilename: string
  sourceMediaHref: string
  fps?: number
  aspect?: string
  resolution?: ExportResolution
}): string {
  const fps = opts.fps && opts.fps > 0 ? opts.fps : DEFAULT_FPS
  const bounds = opts.bounds
  const edits = normalizeEdits(opts.edits, bounds)
  const { segments, timelineDurationSec } = clipEditsToFcpxmlSegments(edits, bounds)
  const aspect = parseExportAspect(opts.aspect ?? edits.aspectRatio ?? '9:16') ?? '9:16'
  const resolution = opts.resolution ?? '1080p'
  const { width, height } = exportPixelSize(aspect, resolution)
  const title = escapeXml(opts.title.trim() || 'Transovo clip')
  const durationFrames = secToFrames(timelineDurationSec || msToFcpxSeconds(opts.clipEndMs - opts.clipStartMs), fps)
  const trackBody =
    segments.length > 0
      ? clipItemsXml(segments, opts.title.trim() || 'Transovo clip', opts.sourceMediaFilename, opts.sourceMediaHref, fps)
      : clipItemsXml(
          [{ offsetSec: 0, sourceStartSec: 0, durationSec: timelineDurationSec }],
          opts.title.trim() || 'Transovo clip',
          opts.sourceMediaFilename,
          opts.sourceMediaHref,
          fps,
        )

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE xmeml>
<xmeml version="4">
  <sequence id="sequence-1">
    <name>${title}</name>
    <duration>${durationFrames}</duration>
    <rate>
      <timebase>${fps}</timebase>
      <ntsc>FALSE</ntsc>
    </rate>
    <timecode>
      <rate>
        <timebase>${fps}</timebase>
        <ntsc>FALSE</ntsc>
      </rate>
      <string>00:00:00:00</string>
      <frame>0</frame>
    </timecode>
    <media>
      <video>
        <format>
          <samplecharacteristics>
            <width>${width}</width>
            <height>${height}</height>
            <pixelaspectratio>Square</pixelaspectratio>
          </samplecharacteristics>
        </format>
        <track>
${trackBody}
        </track>
      </video>
      <audio>
        <track>
          <enabled>TRUE</enabled>
          <locked>FALSE</locked>
        </track>
      </audio>
    </media>
  </sequence>
</xmeml>
`
}
