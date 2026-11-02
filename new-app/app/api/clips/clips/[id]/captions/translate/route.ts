import { NextResponse } from 'next/server'
import { z } from 'zod'
import { jsonError } from '@/lib/server/api-error'
import { TRANSLATE_CAPTION_LANGUAGES } from '@/lib/clips/caption-translate'
import { translateCaptionLinesRobust } from '@/lib/server/clips/caption-translate-batch'
import { getClipForWorkspace } from '@/lib/server/clips/clips'
import { resolveWorkspaceId } from '@/lib/server/workspace'

const bodySchema = z.object({
  targetLang: z.string(),
  lines: z
    .array(z.object({ text: z.string().max(200) }))
    .min(1)
    .max(400),
})

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id: clipId } = await ctx.params
    const workspaceId = await resolveWorkspaceId()
    const clip = await getClipForWorkspace(workspaceId, clipId)
    if (!clip) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const body = bodySchema.parse(await request.json())
    const lang = TRANSLATE_CAPTION_LANGUAGES.find((l) => l.code === body.targetLang)
    if (!lang) return NextResponse.json({ error: 'Invalid language' }, { status: 400 })

    const result = await translateCaptionLinesRobust(lang.label, body.lines)
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 422 })
    }
    return NextResponse.json({ data: { lines: result.lines } })
  } catch (err) {
    return jsonError(err, 400)
  }
}
