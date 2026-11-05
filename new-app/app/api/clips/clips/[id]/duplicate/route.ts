import { NextResponse } from 'next/server'
import { jsonError } from '@/lib/server/api-error'
import { resolveWorkspaceId } from '@/lib/server/workspace'
import { getClipForWorkspace } from '@/lib/server/clips/clips'
import { getPrisma } from '@/lib/server/db'
import { createId } from '@/lib/supabase/id'
import { toPrismaJson } from '@/lib/server/clips/prisma-json'

/** Clone the actual edited clip, not a fresh transcript-derived selection. */
export async function POST(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params
    const workspaceId = await resolveWorkspaceId()
    const parent = await getClipForWorkspace(workspaceId, id)
    if (!parent) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    const clipId = createId('clip')
    const title = `${parent.title.slice(0, 114)} copy`
    await getPrisma().clip.create({
      data: {
        id: clipId,
        workspaceId,
        projectId: parent.projectId,
        title,
        reason: parent.reason ?? 'derived',
        startMs: parent.startMs,
        endMs: parent.endMs,
        score: parent.score,
        scores: toPrismaJson(parent.scores ?? {}),
        favorite: false,
        aiMeta: toPrismaJson(parent.aiMeta ?? {}),
        edits: toPrismaJson(parent.edits ?? {}),
        cropKey: parent.cropKey,
        wordsKey: parent.wordsKey,
        previewKey: parent.previewKey,
        posterKey: parent.posterKey,
        sourceSegKey: parent.sourceSegKey,
        sourceSegStartMs: parent.sourceSegStartMs,
        sourceSegEndMs: parent.sourceSegEndMs,
        storageDriver: parent.storageDriver,
      },
    })
    return NextResponse.json({ data: { clipId, projectId: parent.projectId } })
  } catch (error) {
    return jsonError(error, 500)
  }
}
