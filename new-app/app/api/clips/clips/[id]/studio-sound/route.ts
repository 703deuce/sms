import { NextResponse } from 'next/server'
import { jsonError } from '@/lib/server/api-error'
import { getClipForWorkspace } from '@/lib/server/clips/clips'
import { normalizeEdits, outputDurationMs } from '@/lib/clips/edits'
import { getPrisma } from '@/lib/server/db'
import { resolveWorkspaceId } from '@/lib/server/workspace'
import { createId } from '@/lib/supabase/id'

export async function POST(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id: clipId } = await ctx.params
    const workspaceId = await resolveWorkspaceId()
    const clip = await getClipForWorkspace(workspaceId, clipId)
    if (!clip) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const bounds = { clipStartMs: clip.startMs, clipEndMs: clip.endMs }
    const edits = normalizeEdits(clip.edits, bounds)
    const lengthMs = Math.max(3000, Math.min(300_000, outputDurationMs(edits)))

    const prisma = getPrisma()
    const project = await prisma.clipProject.findFirst({
      where: { id: clip.projectId, workspaceId },
      include: { upload: true },
    })
    const sourceKey = project?.upload?.key
    if (!sourceKey) return NextResponse.json({ error: 'No source upload' }, { status: 400 })

    const gen = await prisma.aiGeneration.create({
      data: {
        workspaceId,
        clipId,
        kind: 'STUDIO_SOUND',
        status: 'PENDING',
        provider: 'elevenlabs',
        prompt: 'studio-sound',
        params: { clipId, sourceKey, lengthMs },
      },
    })

    const jobId = createId('job')
    await prisma.clipJob.create({
      data: {
        id: jobId,
        projectId: clip.projectId,
        clipId,
        type: 'STUDIO_SOUND',
        status: 'QUEUED',
        payload: { generationId: gen.id, clipId, sourceKey },
      },
    })

    return NextResponse.json({ data: { generationId: gen.id, jobId, status: 'PENDING' } })
  } catch (err) {
    return jsonError(err, 400)
  }
}
