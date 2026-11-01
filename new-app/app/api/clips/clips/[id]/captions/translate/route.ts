import { NextResponse } from 'next/server'
import { z } from 'zod'
import { jsonError } from '@/lib/server/api-error'
import { TRANSLATE_CAPTION_LANGUAGES } from '@/lib/clips/caption-translate'
import { openAiJsonWithGeminiFallback } from '@/lib/server/ai/openai-json'
import { getClipForWorkspace } from '@/lib/server/clips/clips'
import { resolveWorkspaceId } from '@/lib/server/workspace'

const bodySchema = z.object({
  targetLang: z.string(),
  lines: z
    .array(z.object({ text: z.string().max(200) }))
    .min(1)
    .max(400),
})

const SYSTEM = `Translate each caption line to the target language. Keep meaning; do not add lines.
Return JSON {"lines":[string]} with exactly the same number of strings as the input.`

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id: clipId } = await ctx.params
    const workspaceId = await resolveWorkspaceId()
    const clip = await getClipForWorkspace(workspaceId, clipId)
    if (!clip) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const body = bodySchema.parse(await request.json())
    const lang = TRANSLATE_CAPTION_LANGUAGES.find((l) => l.code === body.targetLang)
    if (!lang) return NextResponse.json({ error: 'Invalid language' }, { status: 400 })

    const raw = await openAiJsonWithGeminiFallback<{ lines?: string[] }>(
      'caption_translate',
      SYSTEM,
      JSON.stringify({ targetLang: lang.label, lines: body.lines.map((l) => l.text) }),
      {
        type: 'object',
        properties: { lines: { type: 'array', items: { type: 'string' } } },
      },
    )

    const out = (raw.lines ?? []).map((s) => String(s ?? '').slice(0, 200))
    if (out.length !== body.lines.length) {
      return NextResponse.json({ error: 'translate_mismatch' }, { status: 422 })
    }
    return NextResponse.json({ data: { lines: out } })
  } catch (err) {
    return jsonError(err, 400)
  }
}
