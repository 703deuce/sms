import { NextResponse } from 'next/server'
import { z } from 'zod'
import { jsonError } from '@/lib/server/api-error'
import {
  notifyMentionedUsers,
  replyToThread,
  setThreadResolved,
} from '@/lib/server/clips/composition-comments'
import { getCompositionForWorkspace } from '@/lib/server/clips/script-composition'
import { getPrisma } from '@/lib/server/db'
import { resolveInternalUserId } from '@/lib/server/internal-user'
import { resolveWorkspaceId } from '@/lib/server/workspace'

const replySchema = z.object({
  body: z.string().min(1).max(8000),
  parentCommentId: z.string().optional(),
  mentionedUserIds: z.array(z.string()).optional(),
})

const resolveSchema = z.object({
  resolved: z.boolean(),
})

export async function POST(request: Request, ctx: { params: Promise<{ compositionId: string; threadId: string }> }) {
  try {
    const { compositionId, threadId } = await ctx.params
    const workspaceId = await resolveWorkspaceId()
    const userId = await resolveInternalUserId()
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
    return jsonError(err, 500)
  }
}

export async function PATCH(request: Request, ctx: { params: Promise<{ compositionId: string; threadId: string }> }) {
  try {
    const { compositionId, threadId } = await ctx.params
    const workspaceId = await resolveWorkspaceId()
    const userId = await resolveInternalUserId()
    const body = resolveSchema.parse(await request.json())
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
    return jsonError(err, 500)
  }
}
