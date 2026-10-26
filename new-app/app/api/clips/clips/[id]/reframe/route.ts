import { NextResponse } from 'next/server'
import { jsonError } from '@/lib/server/api-error'
import { getClipForWorkspace } from '@/lib/server/clips/clips'
import { getPrisma } from '@/lib/server/db'
import { resolveWorkspaceId } from '@/lib/server/workspace'
import { createId } from '@/lib/supabase/id'

export async function POST(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id: clipId } = await ctx.params
    const workspaceId = await resolveWorkspaceId()
    const clip = await getClipForWorkspace(workspaceId, clipId)
    if (!clip) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    const prisma = getPrisma()
    const jobId = createId('job')
    await prisma.clipJob.create({
      data: {
        id: jobId,
        projectId: clip.projectId,
        clipId,
        type: 'REFRAME_CROP',
        status: 'QUEUED',
        payload: {},
      },
    })
    return NextResponse.json({ data: { jobId } })
  } catch (err) {
    return jsonError(err, 500)
  }
}
