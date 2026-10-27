import type { Prisma } from '@prisma/client'
import { getPrisma } from '@/lib/server/db'
import { createId } from '@/lib/supabase/id'
import { getCompositionForWorkspace } from '@/lib/server/clips/script-composition'

export type CommentThreadDto = {
  id: string
  startOutMs: number
  endOutMs: number
  anchorWordStart: string | null
  anchorWordEnd: string | null
  quoteText: string | null
  resolvedAt: string | null
  resolvedById: string | null
  createdAt: string
  comments: CommentDto[]
}

export type CommentDto = {
  id: string
  threadId: string
  parentCommentId: string | null
  authorUserId: string
  authorName: string
  body: string
  mentionedUserIds: string[]
  createdAt: string
}

export async function listCompositionCommentThreads(
  workspaceId: string,
  compositionId: string,
  opts?: { scope?: 'clip' | 'full'; fullCompositionId?: string | null },
) {
  const row = await getCompositionForWorkspace(workspaceId, compositionId)
  if (!row) return null

  const prisma = getPrisma()
  const compositionIds =
    opts?.scope === 'full' && opts.fullCompositionId && opts.fullCompositionId !== compositionId
      ? [compositionId, opts.fullCompositionId]
      : [compositionId]

  const threads = await prisma.scriptCompositionCommentThread.findMany({
    where: { compositionId: { in: compositionIds } },
    orderBy: { startOutMs: 'asc' },
    include: {
      comments: {
        orderBy: { createdAt: 'asc' },
      },
    },
  })

  const userIds = new Set<string>()
  for (const t of threads) {
    for (const c of t.comments) userIds.add(c.authorUserId)
  }
  const users = userIds.size
    ? await prisma.user.findMany({
        where: { id: { in: [...userIds] } },
        select: { id: true, name: true, email: true },
      })
    : []
  const nameById = new Map(users.map((u) => [u.id, u.name ?? u.email ?? 'User']))

  return threads.map((t) => toThreadDto(t, nameById))
}

export async function deleteCommentThread(workspaceId: string, compositionId: string, threadId: string) {
  const row = await getCompositionForWorkspace(workspaceId, compositionId)
  if (!row) return { ok: false as const, code: 'NOT_FOUND' as const }
  const prisma = getPrisma()
  await prisma.scriptCompositionComment.deleteMany({ where: { threadId } })
  await prisma.scriptCompositionCommentThread.deleteMany({ where: { id: threadId, compositionId } })
  return { ok: true as const }
}

export async function updateCommentBody(input: {
  workspaceId: string
  compositionId: string
  commentId: string
  userId: string
  body: string
}) {
  const row = await getCompositionForWorkspace(input.workspaceId, input.compositionId)
  if (!row) return { ok: false as const, code: 'NOT_FOUND' as const }
  const prisma = getPrisma()
  const comment = await prisma.scriptCompositionComment.findFirst({
    where: { id: input.commentId },
    include: { thread: true },
  })
  if (!comment || comment.thread.compositionId !== input.compositionId) {
    return { ok: false as const, code: 'NOT_FOUND' as const }
  }
  if (comment.authorUserId !== input.userId) return { ok: false as const, code: 'FORBIDDEN' as const }
  await prisma.scriptCompositionComment.update({
    where: { id: input.commentId },
    data: { body: input.body.trim() },
  })
  const threads = await listCompositionCommentThreads(input.workspaceId, input.compositionId)
  const thread = threads?.find((t) => t.id === comment.threadId)
  return { ok: true as const, thread }
}

function toThreadDto(
  t: Prisma.ScriptCompositionCommentThreadGetPayload<{ include: { comments: true } }>,
  nameById: Map<string, string>,
): CommentThreadDto {
  return {
    id: t.id,
    startOutMs: t.startOutMs,
    endOutMs: t.endOutMs,
    anchorWordStart: t.anchorWordStart,
    anchorWordEnd: t.anchorWordEnd,
    quoteText: t.quoteText,
    resolvedAt: t.resolvedAt?.toISOString() ?? null,
    resolvedById: t.resolvedById,
    createdAt: t.createdAt.toISOString(),
    comments: t.comments.map((c) => ({
      id: c.id,
      threadId: c.threadId,
      parentCommentId: c.parentCommentId,
      authorUserId: c.authorUserId,
      authorName: nameById.get(c.authorUserId) ?? 'User',
      body: c.body,
      mentionedUserIds: c.mentionedUserIds,
      createdAt: c.createdAt.toISOString(),
    })),
  }
}

export async function createCommentThread(input: {
  workspaceId: string
  compositionId: string
  authorUserId: string
  body: string
  startOutMs: number
  endOutMs: number
  anchorWordStart?: string
  anchorWordEnd?: string
  quoteText?: string
  mentionedUserIds?: string[]
}) {
  const row = await getCompositionForWorkspace(input.workspaceId, input.compositionId)
  if (!row) return { ok: false as const, code: 'NOT_FOUND' as const }

  const prisma = getPrisma()
  const threadId = createId('scth')
  const commentId = createId('scmt')

  await prisma.$transaction([
    prisma.scriptCompositionCommentThread.create({
      data: {
        id: threadId,
        compositionId: input.compositionId,
        workspaceId: input.workspaceId,
        startOutMs: Math.round(input.startOutMs),
        endOutMs: Math.round(input.endOutMs),
        anchorWordStart: input.anchorWordStart ?? null,
        anchorWordEnd: input.anchorWordEnd ?? null,
        quoteText: input.quoteText ?? null,
        createdById: input.authorUserId,
      },
    }),
    prisma.scriptCompositionComment.create({
      data: {
        id: commentId,
        threadId,
        authorUserId: input.authorUserId,
        body: input.body.trim(),
        mentionedUserIds: input.mentionedUserIds ?? [],
      },
    }),
  ])

  const threads = await listCompositionCommentThreads(input.workspaceId, input.compositionId)
  const thread = threads?.find((x) => x.id === threadId)
  return { ok: true as const, thread }
}

export async function replyToThread(input: {
  workspaceId: string
  compositionId: string
  threadId: string
  authorUserId: string
  body: string
  parentCommentId?: string
  mentionedUserIds?: string[]
}) {
  const row = await getCompositionForWorkspace(input.workspaceId, input.compositionId)
  if (!row) return { ok: false as const, code: 'NOT_FOUND' as const }

  const prisma = getPrisma()
  const thread = await prisma.scriptCompositionCommentThread.findFirst({
    where: { id: input.threadId, compositionId: input.compositionId },
  })
  if (!thread) return { ok: false as const, code: 'NOT_FOUND' as const }

  const commentId = createId('scmt')
  await prisma.scriptCompositionComment.create({
    data: {
      id: commentId,
      threadId: input.threadId,
      parentCommentId: input.parentCommentId ?? null,
      authorUserId: input.authorUserId,
      body: input.body.trim(),
      mentionedUserIds: input.mentionedUserIds ?? [],
    },
  })

  const threads = await listCompositionCommentThreads(input.workspaceId, input.compositionId)
  const updated = threads?.find((x) => x.id === input.threadId)
  return { ok: true as const, thread: updated }
}

export async function setThreadResolved(input: {
  workspaceId: string
  compositionId: string
  threadId: string
  userId: string
  resolved: boolean
}) {
  const row = await getCompositionForWorkspace(input.workspaceId, input.compositionId)
  if (!row) return { ok: false as const, code: 'NOT_FOUND' as const }

  const prisma = getPrisma()
  await prisma.scriptCompositionCommentThread.updateMany({
    where: { id: input.threadId, compositionId: input.compositionId },
    data: input.resolved
      ? { resolvedAt: new Date(), resolvedById: input.userId }
      : { resolvedAt: null, resolvedById: null },
  })

  const threads = await listCompositionCommentThreads(input.workspaceId, input.compositionId)
  const updated = threads?.find((x) => x.id === input.threadId)
  return { ok: true as const, thread: updated }
}

export async function notifyMentionedUsers(input: {
  workspaceId: string
  compositionId: string
  compositionTitle: string
  mentionedUserIds: string[]
  authorName: string
  threadId: string
}) {
  const unique = [...new Set(input.mentionedUserIds)].filter(Boolean)
  if (!unique.length) return

  const prisma = getPrisma()
  const href = `/app/clips/${(await getCompositionForWorkspace(input.workspaceId, input.compositionId))?.projectId}/script?comment=${input.threadId}`
  await prisma.inAppNotification.createMany({
    data: unique.map((userId) => ({
      id: createId('noti'),
      workspaceId: input.workspaceId,
      userId,
      type: 'script_comment_mention',
      title: `${input.authorName} mentioned you in a comment`,
      body: input.compositionTitle,
      href,
    })),
  })
}
