import { NextResponse } from 'next/server'
import { jsonError } from '@/lib/server/api-error'
import { findActiveRenderForClip } from '@/lib/server/clips/renders'
import { resolveWorkspaceId } from '@/lib/server/workspace'

/**
 * FV4c (read-only): the newest in-flight export of this clip with a live job, or null. The export
 * dialog calls this on open so a reopened dialog / reloaded editor shows "Rendering…" and resumes
 * that render's progress instead of offering a fresh Export MP4.
 */
export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id: clipId } = await ctx.params
    const workspaceId = await resolveWorkspaceId()
    const active = await findActiveRenderForClip(workspaceId, clipId)
    if (!active) return NextResponse.json({ data: { render: null } })
    const { render } = active
    return NextResponse.json({
      data: {
        render: {
          id: render.id,
          status: render.status === 'RENDERING' ? 'RENDERING' : 'QUEUED',
          resolution: render.resolution,
          aspectRatio: render.aspectRatio,
          createdAt: render.createdAt.toISOString(),
        },
      },
    })
  } catch (err) {
    return jsonError(err, 500)
  }
}
