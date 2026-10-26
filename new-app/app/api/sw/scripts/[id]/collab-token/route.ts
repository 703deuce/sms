import { NextResponse } from 'next/server'
import { jsonError } from '@/lib/server/api-error'
import { requireSwActor } from '@/lib/screenwriting/server/actor'
import { getScriptForOwner } from '@/lib/screenwriting/server/scripts'
import { signCollabToken } from '@/lib/screenwriting/collab/token'

export async function POST(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireSwActor()
    const { id } = await ctx.params
    const row = await getScriptForOwner(id, actor.id)
    if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    const token = signCollabToken({ scriptId: id, actorId: actor.id, role: 'OWNER' })
    return NextResponse.json({
      data: {
        token,
        url: process.env.SW_COLLAB_WS_URL || 'wss://collab.transovo.ai',
      },
    })
  } catch (err) {
    return jsonError(err, 400)
  }
}
