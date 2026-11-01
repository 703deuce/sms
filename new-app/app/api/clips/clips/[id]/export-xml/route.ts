import { NextResponse } from 'next/server'
import {
  buildFcpxmlFromClipEdits,
  fcpxmlDownloadFilename,
} from '@/lib/clips/export-xml'
import { jsonError } from '@/lib/server/api-error'
import { getClipForWorkspace } from '@/lib/server/clips/clips'
import { resolveWorkspaceId } from '@/lib/server/workspace'

const PLACEHOLDER_SOURCE = 'file:///SOURCE_MEDIA'

export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params
    const workspaceId = await resolveWorkspaceId()
    const clip = await getClipForWorkspace(workspaceId, id)
    if (!clip) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const bounds = { clipStartMs: clip.startMs, clipEndMs: clip.endMs }
    const xml = buildFcpxmlFromClipEdits({
      title: clip.title,
      clipStartMs: clip.startMs,
      clipEndMs: clip.endMs,
      edits: clip.edits,
      bounds,
      sourceMediaHref: PLACEHOLDER_SOURCE,
      sourceDurationMs: clip.endMs - clip.startMs,
    })
    const filename = fcpxmlDownloadFilename(clip.title)
    return new NextResponse(xml, {
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (err) {
    return jsonError(err, 500)
  }
}
