import { NextResponse } from 'next/server'
import { jsonError } from '@/lib/server/api-error'
import { isDatabaseReady } from '@/lib/server/app-readiness'
import { getPrisma } from '@/lib/server/db'
import { resolveInternalUserId } from '@/lib/server/internal-user'
import { resolveWorkspaceId } from '@/lib/server/workspace'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 15

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('notifications_query_timeout')), ms)
    p.then(
      (v) => {
        clearTimeout(t)
        resolve(v)
      },
      (e) => {
        clearTimeout(t)
        reject(e)
      },
    )
  })
}

export async function GET(request: Request) {
  try {
    if (!(await isDatabaseReady())) {
      return NextResponse.json(
        { data: { items: [], nextCursor: null } },
        { status: 503, headers: { 'Retry-After': '3' } },
      )
    }
    const workspaceId = await resolveWorkspaceId()
    let userId: string
    try {
      userId = await resolveInternalUserId()
    } catch {
      return NextResponse.json({ data: { items: [], nextCursor: null } })
    }
    const prisma = getPrisma()
    const url = new URL(request.url)
    const cursor = url.searchParams.get('cursor')
    const items = await withTimeout(
      prisma.inAppNotification.findMany({
      where: { workspaceId, userId },
      orderBy: { createdAt: 'desc' },
      take: 30,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      }),
      8000,
    )
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
    const msg = err instanceof Error ? err.message : String(err)
    if (msg.includes('notifications_query_timeout')) {
      return NextResponse.json(
        { data: { items: [], nextCursor: null } },
        { status: 503, headers: { 'Retry-After': '2' } },
      )
    }
    return jsonError(err, 500)
  }
}
