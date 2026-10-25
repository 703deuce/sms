import { NextResponse } from 'next/server'
import { can } from '@/lib/billing/entitlements'
import { jsonError } from '@/lib/server/api-error'
import { exportFilename, getClipForWorkspace } from '@/lib/server/clips/clips'
import { logClipEvent } from '@/lib/server/clips/events'
import { getPrisma } from '@/lib/server/db'
import { getClipStorage } from '@/lib/storage'
import { createId } from '@/lib/supabase/id'
import { resolveWorkspaceId } from '@/lib/server/workspace'

export async function POST(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id: clipId } = await ctx.params
    const workspaceId = await resolveWorkspaceId()
    const clip = await getClipForWorkspace(workspaceId, clipId)
    if (!clip?.previewKey) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const watermark = !can(workspaceId, 'no_watermark')
    const filename = exportFilename(clip.title)
    const prisma = getPrisma()
    const renderId = createId('rnd')
    await prisma.clipRender.create({
      data: {
        id: renderId,
        clipId: clip.id,
        workspaceId,
        status: 'READY',
        outputKey: clip.previewKey,
        watermark,
        filename,
        resolution: '720p',
      },
    })

    await logClipEvent(workspaceId, clip.id, 'download')
    const url = await getClipStorage().createSignedDownloadUrl(clip.previewKey, 3600)
    return NextResponse.json({
      data: {
        renderId,
        downloadUrl: url,
        filename,
        watermark,
      },
    })
  } catch (err) {
    return jsonError(err, 400)
  }
}
