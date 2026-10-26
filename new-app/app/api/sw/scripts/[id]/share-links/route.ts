import { NextResponse } from 'next/server'
import { z } from 'zod'
import { jsonError } from '@/lib/server/api-error'
import { requireSwActor } from '@/lib/screenwriting/server/actor'
import { getScriptForOwner } from '@/lib/screenwriting/server/scripts'
import { getPrisma } from '@/lib/server/db'
import { generateShareToken, hashShareToken } from '@/lib/screenwriting/sharing/token'

const postSchema = z.object({
  role: z.enum(['VIEWER', 'COMMENTER', 'EDITOR']).default('VIEWER'),
  expiresAt: z.string().datetime().optional(),
  watermark: z.boolean().optional(),
  allowDownload: z.boolean().optional(),
})

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireSwActor()
    const { id } = await ctx.params
    const body = postSchema.parse(await request.json())
    const row = await getScriptForOwner(id, actor.id)
    if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    const token = generateShareToken()
    const prisma = getPrisma()
    const link = await prisma.swShareLink.create({
      data: {
        scriptId: id,
        tokenHash: hashShareToken(token),
        role: body.role,
        expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
        watermark: body.watermark ?? false,
        allowDownload: body.allowDownload ?? true,
      },
    })
    return NextResponse.json({ data: { link, token } })
  } catch (err) {
    return jsonError(err, 400)
  }
}
