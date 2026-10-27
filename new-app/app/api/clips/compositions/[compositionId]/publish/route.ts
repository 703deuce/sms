import { NextResponse } from 'next/server'
import { z } from 'zod'
import { jsonError } from '@/lib/server/api-error'
import { getCompositionForWorkspace } from '@/lib/server/clips/script-composition'
import { syncPublishOutputFromRender, unpublish, upsertPublish } from '@/lib/server/clips/composition-share'
import { ForbiddenError } from '@/lib/server/auth/session'
import { resolveClipsActorUserId } from '@/lib/server/clips/clips-auth'
import { assertCanManageCompositionShare } from '@/lib/server/clips/composition-access'
import { resolveWorkspaceId } from '@/lib/server/workspace'

const publishSchema = z.object({
  showTranscript: z.boolean().optional(),
  allowComments: z.boolean().optional(),
  allowDownload: z.boolean().optional(),
  showAuthor: z.boolean().optional(),
  requireSignInToView: z.boolean().optional(),
  requireSignInToEmbed: z.boolean().optional(),
  authorDisplayName: z.string().max(120).optional(),
})

export async function GET(_req: Request, ctx: { params: Promise<{ compositionId: string }> }) {
  try {
    const { compositionId } = await ctx.params
    const workspaceId = await resolveWorkspaceId()
    const comp = await getCompositionForWorkspace(workspaceId, compositionId)
    if (!comp) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    const prisma = (await import('@/lib/server/db')).getPrisma()
    const pub = await prisma.scriptCompositionPublish.findUnique({ where: { compositionId } })
    return NextResponse.json({
      data: pub
        ? {
            publicSlug: pub.publicSlug,
            publishedAt: pub.publishedAt.toISOString(),
            viewCount: pub.viewCount,
            settings: pub.settings,
          }
        : null,
    })
  } catch (err) {
    return jsonError(err, 500)
  }
}

export async function POST(request: Request, ctx: { params: Promise<{ compositionId: string }> }) {
  try {
    const { compositionId } = await ctx.params
    const workspaceId = await resolveWorkspaceId()
    const userId = await resolveClipsActorUserId(request)
    await assertCanManageCompositionShare(workspaceId, compositionId, userId)
    const settings = publishSchema.parse(await request.json())
    const pub = await upsertPublish(workspaceId, compositionId, settings, userId)
    if (!pub) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    const synced = (await syncPublishOutputFromRender(compositionId)) ?? pub
    return NextResponse.json({
      data: {
        publicSlug: synced.publicSlug,
        publishedAt: synced.publishedAt.toISOString(),
        settings: synced.settings,
        outputKey: synced.outputKey,
        playbackStatus: synced.outputKey ? 'ready' : 'processing',
      },
    })
  } catch (err) {
    if (err instanceof ForbiddenError) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    return jsonError(err, 500)
  }
}

export async function PATCH(request: Request, ctx: { params: Promise<{ compositionId: string }> }) {
  try {
    const { compositionId } = await ctx.params
    const workspaceId = await resolveWorkspaceId()
    const userId = await resolveClipsActorUserId(request)
    await assertCanManageCompositionShare(workspaceId, compositionId, userId)
    const settings = publishSchema.parse(await request.json())
    const pub = await upsertPublish(workspaceId, compositionId, settings, userId)
    if (!pub) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({
      data: {
        publicSlug: pub.publicSlug,
        viewCount: pub.viewCount,
        settings: pub.settings,
      },
    })
  } catch (err) {
    if (err instanceof ForbiddenError) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    return jsonError(err, 400)
  }
}

export async function DELETE(request: Request, ctx: { params: Promise<{ compositionId: string }> }) {
  try {
    const { compositionId } = await ctx.params
    const workspaceId = await resolveWorkspaceId()
    const userId = await resolveClipsActorUserId(request)
    await assertCanManageCompositionShare(workspaceId, compositionId, userId)
    await unpublish(workspaceId, compositionId)
    return NextResponse.json({ data: { ok: true } })
  } catch (err) {
    if (err instanceof ForbiddenError) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    return jsonError(err, 500)
  }
}
