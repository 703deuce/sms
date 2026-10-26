import { NextResponse } from 'next/server'
import { z } from 'zod'
import { jsonError } from '@/lib/server/api-error'
import { requireSwActor } from '@/lib/screenwriting/server/actor'
import { getScriptForOwner } from '@/lib/screenwriting/server/scripts'
import { estimateCredits, stableInputHash, type AiJobKind } from '@/lib/screenwriting/ai/estimate'

const kinds = new Set<AiJobKind>([
  'assist',
  'scene_feedback',
  'character_feedback',
  'coverage',
  'synopsis_long',
])

const bodySchema = z.object({
  scope: z.record(z.unknown()).optional(),
  confirm: z.boolean().optional(),
})

export async function POST(request: Request, ctx: { params: Promise<{ id: string; kind: string }> }) {
  try {
    const actor = await requireSwActor()
    const { id, kind } = await ctx.params
    if (!kinds.has(kind as AiJobKind)) {
      return NextResponse.json({ error: 'Unknown AI kind' }, { status: 400 })
    }
    const row = await getScriptForOwner(id, actor.id)
    if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    const body = bodySchema.parse(await request.json().catch(() => ({})))
    const scope = (body.scope ?? { words: row.wordCount }) as { scenes?: number; words?: number }
    const credits = estimateCredits(kind as AiJobKind, scope)
    const inputHash = stableInputHash({ kind, scriptId: id, scope })
    if (!body.confirm) {
      return NextResponse.json({ data: { estimateCredits: credits, inputHash, needsConfirm: credits > 0 } })
    }
    return NextResponse.json({
      data: {
        jobId: `swjob_${inputHash.slice(0, 12)}`,
        status: 'queued',
        creditCost: credits,
        actorId: actor.id,
      },
    })
  } catch (err) {
    return jsonError(err, 400)
  }
}
