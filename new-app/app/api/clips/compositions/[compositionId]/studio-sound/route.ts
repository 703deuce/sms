import { NextResponse } from 'next/server'
import { jsonError } from '@/lib/server/api-error'
import { getCompositionAudioContext } from '@/lib/server/clips/composition-audio'
import { getPrisma } from '@/lib/server/db'
import { resolveWorkspaceId } from '@/lib/server/workspace'
import { createId } from '@/lib/supabase/id'

export async function POST(_request: Request, ctx: { params: Promise<{ compositionId: string }> }) {
  try {
    const { compositionId } = await ctx.params
    const workspaceId = await resolveWorkspaceId()
    const audioCtx = await getCompositionAudioContext(workspaceId, compositionId)
    if (!audioCtx) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const prisma = getPrisma()
    const project = await prisma.clipProject.findFirst({
      where: { id: audioCtx.projectId, workspaceId },
      include: { upload: true },
    })
    const sourceKey = project?.upload?.key
    if (!sourceKey) return NextResponse.json({ error: 'No source upload' }, { status: 400 })

    const gen = await prisma.aiGeneration.create({
      data: {
        workspaceId,
        clipId: audioCtx.clipId ?? undefined,
        kind: 'STUDIO_SOUND',
        status: 'PENDING',
        provider: 'elevenlabs',
        prompt: 'studio-sound',
        params: { compositionId, sourceKey, lengthMs: audioCtx.lengthMs },
      },
    })

    const jobId = createId('job')
    await prisma.clipJob.create({
      data: {
        id: jobId,
        projectId: audioCtx.projectId,
        clipId: audioCtx.clipId,
        type: 'STUDIO_SOUND',
        status: 'QUEUED',
        payload: { generationId: gen.id, compositionId, sourceKey },
      },
    })

    return NextResponse.json({ data: { generationId: gen.id, status: 'PENDING' } })
  } catch (err) {
    return jsonError(err, 400)
  }
}
