import { NextResponse } from 'next/server'
import { z } from 'zod'
import { jsonError } from '@/lib/server/api-error'
import { getPrisma } from '@/lib/server/db'
import { resolveInternalUserId } from '@/lib/server/internal-user'
import { resolveWorkspaceId } from '@/lib/server/workspace'

const schema = z.object({
  ids: z.array(z.string()).optional(),
  all: z.boolean().optional(),
})

export async function POST(request: Request) {
  try {
    const workspaceId = await resolveWorkspaceId()
    const userId = await resolveInternalUserId()
    const body = schema.parse(await request.json())
    const prisma = getPrisma()
    if (body.all) {
      await prisma.inAppNotification.updateMany({
        where: { workspaceId, userId, readAt: null },
        data: { readAt: new Date() },
      })
    } else if (body.ids?.length) {
      await prisma.inAppNotification.updateMany({
        where: { workspaceId, userId, id: { in: body.ids } },
        data: { readAt: new Date() },
      })
    }
    return NextResponse.json({ data: { ok: true } })
  } catch (err) {
    return jsonError(err, 500)
  }
}
