import { NextResponse } from 'next/server'
import { z } from 'zod'
import { jsonError } from '@/lib/server/api-error'
import {
  createCommentThread,
  listCompositionCommentThreads,
  notifyMentionedUsers,
} from '@/lib/server/clips/composition-comments'
import { getCompositionForWorkspace } from '@/lib/server/clips/script-composition'
import { getPrisma } from '@/lib/server/db'
import { resolveInternalUserId } from '@/lib/server/internal-user'
import { resolveWorkspaceId } from '@/lib/server/workspace'

const createSchema = z.object({
  body: z.string().min(1).max(8000),
  startOutMs: z.number().min(0),
  endOutMs: z.number().min(0),
  anchorWordStart: z.string().optional(),
  anchorWordEnd: z.string().optional(),
  quoteText: z.string().max(2000).optional(),
  mentionedUserIds: z.array(z.string()).optional(),
})

export async function GET(_req: Request, ctx: { params: Promise<{ compositionId: string }> }) {
  try {
    const { compositionId } = await ctx.params
    const workspaceId = await resolveWorkspaceId()
    const threads = await listCompositionCommentThreads(workspaceId, compositionId)
    if (!threads) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ data: { threads } })
  } catch (err) {
    return jsonError(err, 500)
  }
}

export async function POST(request: Request, ctx: { params: Promise<{ compositionId: string }> }) {
  try {
    const { compositionId } = await ctx.params
    const workspaceId = await resolveWorkspaceId()
    const userId = await resolveInternalUserId()
    const body = createSchema.parse(await request.json())
    const comp = await getCompositionForWorkspace(workspaceId, compositionId)
    if (!comp) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const result = await createCommentThread({
      workspaceId,
      compositionId,
      authorUserId: userId,
      ...body,
    })
    if (!result.ok) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    if (body.mentionedUserIds?.length) {
      const prismaUser = await getPrisma().user.findUnique({ where: { id: userId } })
      const authorName = prismaUser?.name ?? 'Someone'
      await notifyMentionedUsers({
        workspaceId,
        compositionId,
        compositionTitle: comp.title,
        mentionedUserIds: body.mentionedUserIds,
        authorName,
        threadId: result.thread!.id,
      })
    }

    return NextResponse.json({ data: { thread: result.thread } })
  } catch (err) {
    return jsonError(err, 500)
  }
}
