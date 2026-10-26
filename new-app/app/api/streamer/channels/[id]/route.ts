import { NextResponse } from 'next/server'
import { z } from 'zod'
import { jsonError } from '@/lib/server/api-error'
import { patchStreamerChannel } from '@/lib/server/streamer/channels'
import { getPrisma } from '@/lib/server/db'
import { resolveWorkspaceId } from '@/lib/server/workspace'

const patchSchema = z.object({
  settings: z.record(z.unknown()).optional(),
  autoProcess: z.boolean().optional(),
  defaultPresetId: z.string().nullable().optional(),
})

export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params
    const workspaceId = await resolveWorkspaceId()
    const body = patchSchema.parse(await request.json())
    const data = await patchStreamerChannel(workspaceId, id, body)
    return NextResponse.json({ data })
  } catch (err) {
    return jsonError(err, 400)
  }
}

export async function DELETE(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params
    const workspaceId = await resolveWorkspaceId()
    const prisma = getPrisma()
    await prisma.streamChannel.updateMany({
      where: { id, workspaceId },
      data: { deletedAt: new Date() },
    })
    return NextResponse.json({ data: { ok: true } })
  } catch (err) {
    return jsonError(err, 500)
  }
}
