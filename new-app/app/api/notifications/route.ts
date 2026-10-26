import { NextResponse } from 'next/server'
import { jsonError } from '@/lib/server/api-error'
import { getPrisma } from '@/lib/server/db'
import { resolveInternalUserId } from '@/lib/server/internal-user'
import { resolveWorkspaceId } from '@/lib/server/workspace'

export async function GET(request: Request) {
  try {
    const workspaceId = await resolveWorkspaceId()
    const userId = await resolveInternalUserId()
    const prisma = getPrisma()
    const url = new URL(request.url)
    const cursor = url.searchParams.get('cursor')
    const items = await prisma.inAppNotification.findMany({
      where: { workspaceId, userId },
      orderBy: { createdAt: 'desc' },
      take: 30,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    })
    return NextResponse.json({
      data: {
        items: items.map((n) => ({
          id: n.id,
          type: n.type,
          title: n.title,
          body: n.body,
          href: n.href,
          read: Boolean(n.readAt),
          at: n.createdAt.toISOString(),
        })),
        nextCursor: items.length === 30 ? items[items.length - 1]?.id : null,
      },
    })
  } catch (err) {
    return jsonError(err, 500)
  }
}
