import { NextResponse } from 'next/server'
import { z } from 'zod'
import { jsonError } from '@/lib/server/api-error'
import {
  deleteCommentThread,
  notifyMentionedUsers,
  replyToThread,
  setThreadResolved,
  updateCommentBody,
} from '@/lib/server/clips/composition-comments'
import { getCompositionForWorkspace } from '@/lib/server/clips/script-composition'
import { getPrisma } from '@/lib/server/db'
import { ForbiddenError } from '@/lib/server/auth/session'
import { resolveClipsActorUserId } from '@/lib/server/clips/clips-auth'
import { assertCanModerateCommentThread } from '@/lib/server/clips/composition-access'
import { resolveWorkspaceId } from '@/lib/server/workspace'

const replySchema = z.object({
  body: z.string().min(1).max(8000),
  parentCommentId: z.string().optional(),
  mentionedUserIds: z.array(z.string()).optional(),
})

const resolveSchema = z.object({
  resolved: z.boolean(),
})

const editSchema = z.object({
  commentId: z.string().min(1),
  body: z.string().min(1).max(8000),
})

export async function POST(request: Request, ctx: { params: Promise<{ compositionId: string; threadId: string }> }) {
  try {
    const { compositionId, threadId } = await ctx.params
    const workspaceId = await resolveWorkspaceId()
    const userId = await resolveClipsActorUserId(request)
    const body = replySchema.parse(await request.json())
    const comp = await getCompositionForWorkspace(workspaceId, compositionId)
    if (!comp) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const result = await replyToThread({
      workspaceId,
      compositionId,
      threadId,
      authorUserId: userId,
      ...body,
    })
    if (!result.ok) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    if (body.mentionedUserIds?.length) {
      const prismaUser = await getPrisma().user.findUnique({ where: { id: userId } })
      await notifyMentionedUsers({
        workspaceId,
        compositionId,
        compositionTitle: comp.title,
        mentionedUserIds: body.mentionedUserIds,
        authorName: prismaUser?.name ?? 'Someone',
        threadId,
      })
    }

    return NextResponse.json({ data: { thread: result.thread } })
  } catch (err) {
    if (err instanceof ForbiddenError) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    return jsonError(err, 500)
  }
}

export async function DELETE(request: Request, ctx: { params: Promise<{ compositionId: string; threadId: string }> }) {
  try {
    const { compositionId, threadId } = await ctx.params
    const workspaceId = await resolveWorkspaceId()
    const userId = await resolveClipsActorUserId(request)
    await assertCanModerateCommentThread({
      workspaceId,
      compositionId,
      userId,
      threadId,
    })
    const result = await deleteCommentThread(workspaceId, compositionId, threadId)
    if (!result.ok) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ data: { ok: true } })
  } catch (err) {
    if (err instanceof ForbiddenError) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    return jsonError(err, 500)
  }
}

export async function PATCH(request: Request, ctx: { params: Promise<{ compositionId: string; threadId: string }> }) {
  try {
    const { compositionId, threadId } = await ctx.params
    const workspaceId = await resolveWorkspaceId()
    const userId = await resolveClipsActorUserId(request)
    const raw = await request.json()
    if (raw && typeof raw === 'object' && 'commentId' in raw) {
      const body = editSchema.parse(raw)
      const result = await updateCommentBody({
        workspaceId,
        compositionId,
        commentId: body.commentId,
        userId,
        body: body.body,
      })
      if (!result.ok) return NextResponse.json({ error: result.code }, { status: result.code === 'FORBIDDEN' ? 403 : 404 })
      return NextResponse.json({ data: { thread: result.thread } })
    }
    const body = resolveSchema.parse(raw)
    await assertCanModerateCommentThread({
      workspaceId,
      compositionId,
      userId,
      threadId,
    })
    const result = await setThreadResolved({
      workspaceId,
      compositionId,
      threadId,
      userId,
      resolved: body.resolved,
    })
    if (!result.ok) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ data: { thread: result.thread } })
  } catch (err) {
    if (err instanceof ForbiddenError) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    return jsonError(err, 500)
  }
}
