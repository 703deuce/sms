import { NextResponse } from 'next/server'
import { z } from 'zod'
import { jsonError } from '@/lib/server/api-error'
import { deriveClipFromSelection } from '@/lib/server/clips/derive-clip'
import { resolveWorkspaceId } from '@/lib/server/workspace'

const bodySchema = z.object({
  trimIn: z.number().int().min(0),
  trimOut: z.number().int().min(0),
  title: z.string().min(1).max(120).optional(),
})

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params
    const workspaceId = await resolveWorkspaceId()
    const body = bodySchema.parse(await request.json())
    if (body.trimOut <= body.trimIn) {
      return NextResponse.json({ error: 'trimOut must be after trimIn' }, { status: 400 })
    }
    const result = await deriveClipFromSelection(workspaceId, id, body)
    if (!result) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ data: result })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.flatten() }, { status: 400 })
    }
    if (err instanceof Error && err.message.includes('too short')) {
      return NextResponse.json({ error: err.message }, { status: 400 })
    }
    return jsonError(err, 500)
  }
}
