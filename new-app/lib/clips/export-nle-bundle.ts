import { basename as pathBasename } from 'node:path/posix'
import type { ExportResolution } from '@/lib/clips/export-aspect'
import {
  buildFcpxmlFromClipEdits,
  fcpxmlDownloadFilename,
  type ClipBounds,
} from '@/lib/clips/export-xml'
import { buildPremiereXmlFromClipEdits } from '@/lib/clips/export-premiere-xml'

/** file:/// URL for NLE relink-by-filename (basename only, no host path). */
export function sourceMediaFileHref(filename: string): string {
  const base = pathBasename(String(filename || 'source.mp4').replace(/\\/g, '/')) || 'source.mp4'
  return `file:///${base}`
}

export function nleZipDownloadFilename(title: string): string {
  const base = title
    .trim()
    .replace(/[^\w\s-]+/g, '')
    .replace(/\s+/g, '-')
    .slice(0, 80)
  return `${base || 'clip'}-nle.zip`
}

export function buildNleExportReadme(opts: {
  title: string
  sourceMediaFilenames: string[]
  fcpxmlName: string
}): string {
  const files = opts.sourceMediaFilenames.length
    ? opts.sourceMediaFilenames.map((f) => `- ${f}`).join('\n')
    : '- (unknown — check your project upload name)'
  return `Transovo NLE export pack
========================

Clip: ${opts.title.trim() || 'Untitled'}

Compatible with:
- Adobe Premiere Pro (import premiere.xml)
- DaVinci Resolve and Final Cut Pro (import ${opts.fcpxmlName}, FCPXML 1.10)

Source media file(s) referenced in the timeline:
${files}

Relink offline media
--------------------
1. Unzip this folder and keep the XML/FCPXML next to your source video file(s), or note the folder where the file(s) above live.
2. In Premiere: File → Import → premiere.xml. In Resolve/FCP: import ${opts.fcpxmlName}.
3. When the NLE reports missing media, browse to the folder containing the source file(s) listed above.
4. Prefer "Relink" / "Reconnect by filename" — paths in this pack use file:/// plus the exact filename (e.g. file:///short_apex_32s.mp4).

Files in this zip
-----------------
- ${opts.fcpxmlName} — Final Cut Pro / DaVinci Resolve timeline (FCPXML 1.10)
- premiere.xml — Adobe Premiere Pro sequence (xmeml)
- captions.srt — subtitle timing from your transcript edits (reference)
- README.txt — this file
`
}

export type NleExportBundleInput = {
  title: string
  sourceMediaFilename: string
  clipStartMs: number
  clipEndMs: number
  edits: unknown
  bounds: ClipBounds
  srt: string
  fps?: number
  resolution?: ExportResolution
}

export function buildNleExportFileMap(input: NleExportBundleInput): Record<string, string> {
  const sourceMediaFilename =
    pathBasename(String(input.sourceMediaFilename || 'source.mp4').replace(/\\/g, '/')) || 'source.mp4'
  const sourceMediaHref = sourceMediaFileHref(sourceMediaFilename)
  const fcpxmlName = fcpxmlDownloadFilename(input.title)
  const fcpxml = buildFcpxmlFromClipEdits({
    title: input.title,
    clipStartMs: input.clipStartMs,
    clipEndMs: input.clipEndMs,
    edits: input.edits,
    bounds: input.bounds,
    sourceMediaHref,
    sourceMediaFilename,
    sourceDurationMs: input.clipEndMs - input.clipStartMs,
    fps: input.fps,
    resolution: input.resolution,
  })
  const premiere = buildPremiereXmlFromClipEdits({
    title: input.title,
    clipStartMs: input.clipStartMs,
    clipEndMs: input.clipEndMs,
    edits: input.edits,
    bounds: input.bounds,
    sourceMediaFilename,
    sourceMediaHref,
    fps: input.fps,
    resolution: input.resolution,
  })
  const readme = buildNleExportReadme({
    title: input.title,
    sourceMediaFilenames: [sourceMediaFilename],
    fcpxmlName,
  })
  return {
    [fcpxmlName]: fcpxml,
    'premiere.xml': premiere,
    'captions.srt': input.srt,
    'README.txt': readme,
  }
}

export async function zipNleExportFiles(files: Record<string, string>): Promise<Buffer> {
  const { ZipArchive } = await import('archiver')
  const archive = new ZipArchive({ zlib: { level: 9 } })
  const chunks: Buffer[] = []
  archive.on('data', (c: Buffer) => chunks.push(c))
  const done = new Promise<Buffer>((resolve, reject) => {
    archive.on('end', () => resolve(Buffer.concat(chunks)))
    archive.on('error', reject)
  })
  for (const [name, body] of Object.entries(files)) {
    archive.append(body, { name })
  }
  await archive.finalize()
  return done
}
