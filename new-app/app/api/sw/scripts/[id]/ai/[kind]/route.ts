import { NextResponse } from 'next/server'
import { z } from 'zod'
import { jsonError } from '@/lib/server/api-error'
import { requireSwActor } from '@/lib/screenwriting/server/actor'
import { chargeCredits } from '@/lib/screenwriting/server/credits'
import { getScriptForOwner } from '@/lib/screenwriting/server/scripts'
import { getPrisma } from '@/lib/server/db'
import { estimateCredits, stableInputHash, type AiJobKind } from '@/lib/screenwriting/ai/estimate'
import { logEditor } from '@/lib/server/clips/script-editor-log'
import { runSwOpenAi } from '@/lib/screenwriting/ai/openai-run'

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
  inputText: z.string().optional(),
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
    const inputHash = stableInputHash({ kind, scriptId: id, scope, inputText: body.inputText?.slice(0, 500) })
    if (!body.confirm) {
      return NextResponse.json({ data: { estimateCredits: credits, inputHash, needsConfirm: credits > 0 } })
    }

    const prisma = getPrisma()
    const cached = await prisma.swAiResult.findFirst({
      where: { scriptId: id, kind, inputHash },
      orderBy: { createdAt: 'desc' },
    })
    if (cached?.output) {
      const out = cached.output as { text?: string }
      return NextResponse.json({ data: { text: out.text, cached: true, inputHash } })
    }

    const inputText =
      body.inputText ||
      JSON.stringify(row.pmJson ?? {}).slice(0, 120_000)
    const started = Date.now()
    const { text, model } = await runSwOpenAi(kind as AiJobKind, inputText)
    logEditor('sw-ai', kind, { scriptId: id, model, latencyMs: Date.now() - started, cached: false })
    await chargeCredits(actor.id, credits, kind)

    await prisma.swAiResult.create({
      data: {
        scriptId: id,
        kind,
        inputHash,
        scope: scope as object,
        output: { text },
        model,
      },
    })

    return NextResponse.json({
      data: { text, model, inputHash, creditCost: credits },
    })
  } catch (err) {
    return jsonError(err, 400)
  }
}
