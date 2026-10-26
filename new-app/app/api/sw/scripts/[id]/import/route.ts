import { NextResponse } from 'next/server'
import { z } from 'zod'
import { jsonError } from '@/lib/server/api-error'
import { requireSwActor } from '@/lib/screenwriting/server/actor'
import { fountainToPmJson } from '@/lib/screenwriting/fountain/convert'
import { parseFdx } from '@/lib/screenwriting/fdx/parse'
import { saveScriptPmJson } from '@/lib/screenwriting/server/scripts'

const bodySchema = z.object({
  format: z.enum(['fountain', 'fdx']),
  text: z.string().min(1).max(8_000_000),
})

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireSwActor()
    const { id } = await ctx.params
    const body = bodySchema.parse(await request.json())
    const pmJson =
      body.format === 'fdx' ? parseFdx(body.text).pmJson : fountainToPmJson(body.text)
    await saveScriptPmJson(id, actor.id, pmJson)
    return NextResponse.json({ data: { ok: true } })
  } catch (err) {
    return jsonError(err, 400)
  }
}
