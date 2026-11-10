import { normalizeEdits } from '@/lib/clips/edits'
import { NextResponse } from 'next/server'
import {
  captionSyncExportDecision,
  captionSyncRequiredBody,
} from '../../../../../../lib/clips/caption-sync-guard'
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

async function buildNleZipForClip(clipId: string, captionSyncAck?: boolean) {
  const workspaceId = await resolveWorkspaceId()
  const prisma = getPrisma()
  const clip = await prisma.clip.findFirst({
    where: { id: clipId, workspaceId, deletedAt: null },
    include: {
      project: { include: { upload: { select: { filename: true } } } },
    },
  })
  if (!clip) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const bounds = { clipStartMs: clip.startMs, clipEndMs: clip.endMs }
  const edits = normalizeEdits(clip.edits, bounds)
  const words = await loadClipSourceWords(clip)
  const decision = captionSyncExportDecision({
    words,
    edits,
    durationMs: Math.max(0, clip.endMs - clip.startMs),
    captionSyncAck,
    format: 'mp4',
  })
  if (decision.blocked) {
    return NextResponse.json(captionSyncRequiredBody({ warnings: decision.warnings }), { status: 409 })
  }
  const srt = buildNleCaptionsSrt(words, edits, bounds)
  const uploadName = clip.project?.upload?.filename?.trim()
  const sourceMediaFilename = uploadName
    ? pathBasename(uploadName.replace(/\\/g, '/'))
    : `${clip.title.trim().replace(/[^\w\s-]+/g, '').replace(/\s+/g, '-') || 'clip'}.mp4`

  const files = buildNleExportFileMap({
    title: clip.title,
    sourceMediaFilename,
    clipStartMs: clip.startMs,
    clipEndMs: clip.endMs,
    edits,
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
}

function ackFromSearch(request: Request): boolean {
  const raw = new URL(request.url).searchParams.get('captionSyncAck')
  return raw === 'true' || raw === '1'
}

export async function GET(request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params
    return await buildNleZipForClip(id, ackFromSearch(request))
  } catch (err) {
    return jsonError(err, 500)
  }
}

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params
    let captionSyncAck = ackFromSearch(request)
    const ct = (request.headers.get('content-type') ?? '').toLowerCase()
    if (ct.includes('application/json')) {
      try {
        const body = (await request.json()) as { captionSyncAck?: boolean }
        if (body?.captionSyncAck === true) captionSyncAck = true
      } catch {
        /* empty or invalid body: fall back to the query flag */
      }
    }
    return await buildNleZipForClip(id, captionSyncAck)
  } catch (err) {
    return jsonError(err, 500)
  }
}
