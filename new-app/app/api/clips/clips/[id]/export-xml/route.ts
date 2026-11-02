import { NextResponse } from 'next/server'
import { buildNleCaptionsSrt } from '@/lib/clips/export-nle-captions'
import {
  buildNleExportFileMap,
  nleZipDownloadFilename,
  zipNleExportFiles,
} from '@/lib/clips/export-nle-bundle'
import { jsonError } from '@/lib/server/api-error'
import { getPrisma } from '@/lib/server/db'
import { loadClipSourceWords } from '@/lib/server/clips/transcript'
import { resolveWorkspaceId } from '@/lib/server/workspace'
import { basename as pathBasename } from 'node:path/posix'

export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params
    const workspaceId = await resolveWorkspaceId()
    const prisma = getPrisma()
    const clip = await prisma.clip.findFirst({
      where: { id, workspaceId, deletedAt: null },
      include: {
        project: { include: { upload: { select: { filename: true } } } },
      },
    })
    if (!clip) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const bounds = { clipStartMs: clip.startMs, clipEndMs: clip.endMs }
    const edits = normalizeEdits(clip.edits, bounds)
    const words = await loadClipSourceWords(clip)
    const srt = buildNleCaptionsSrt(words, clip.edits, bounds)
    const uploadName = clip.project?.upload?.filename?.trim()
    const sourceMediaFilename = uploadName
      ? pathBasename(uploadName.replace(/\\/g, '/'))
      : `${clip.title.trim().replace(/[^\w\s-]+/g, '').replace(/\s+/g, '-') || 'clip'}.mp4`

    const files = buildNleExportFileMap({
      title: clip.title,
      sourceMediaFilename,
      clipStartMs: clip.startMs,
      clipEndMs: clip.endMs,
      edits: clip.edits,
      bounds,
      srt,
    })
    const zip = await zipNleExportFiles(files)
    const filename = nleZipDownloadFilename(clip.title)
    return new NextResponse(zip, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (err) {
    return jsonError(err, 500)
  }
}
