import { NextResponse } from 'next/server'
import { z } from 'zod'
import { jsonError } from '@/lib/server/api-error'
import { requireSwActor } from '@/lib/screenwriting/server/actor'
import { fountainToPmJson } from '@/lib/screenwriting/fountain/convert'
import { parseFdx } from '@/lib/screenwriting/fdx/parse'
import { saveScriptPmJson } from '@/lib/screenwriting/server/scripts'
import { fdxImportStats } from '@/lib/screenwriting/import/fdx-stats'
import { warningsFromFdxParse, type ImportWarning } from '@/lib/screenwriting/import/warnings'

const bodySchema = z.object({
  format: z.enum(['fountain', 'fdx']),
  text: z.string().min(1).max(8_000_000),
})

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireSwActor()
    const { id } = await ctx.params
    const body = bodySchema.parse(await request.json())
    let warnings: ImportWarning[] = []
    const pmJson =
      body.format === 'fdx'
        ? (() => {
            const parsed = parseFdx(body.text)
            warnings = warningsFromFdxParse(fdxImportStats(body.text))
            return parsed.pmJson
          })()
        : fountainToPmJson(body.text)
    if (body.format === 'fountain' && !(pmJson.content?.length ?? 0)) {
      warnings.push({ code: 'empty', message: 'Fountain produced no blocks', severity: 'warn' })
    }
    await saveScriptPmJson(id, actor.id, pmJson)
    return NextResponse.json({ data: { ok: true, warnings } })
  } catch (err) {
    return jsonError(err, 400)
  }
}
