import { NextResponse } from 'next/server'
import { z } from 'zod'
import { jsonError } from '@/lib/server/api-error'
import { resolveWorkspaceId } from '@/lib/server/workspace'
import { extractArticleFromUrl } from '@/lib/server/t2v/extract-url'
import { t2vFeatureDisabledResponse } from '@/lib/server/t2v/t2v-api-guard'

const bodySchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('url'), url: z.string().min(8) }),
  z.object({ kind: z.literal('ppt'), uploadId: z.string() }),
  z.object({ kind: z.literal('audio'), uploadId: z.string() }),
])

export async function POST(request: Request) {
  const disabled = t2vFeatureDisabledResponse()
  if (disabled) return disabled
  try {
    await resolveWorkspaceId()
    const body = bodySchema.parse(await request.json())
    if (body.kind === 'url') {
      const data = await extractArticleFromUrl(body.url)
      return NextResponse.json({
        data: {
          title: data.title,
          text: data.text,
          excerpt: data.excerpt,
          wordCount: data.text.split(/\s+/).filter(Boolean).length,
        },
      })
    }
    return NextResponse.json({ error: 'not_implemented', kind: body.kind }, { status: 501 })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    if (msg.startsWith('t2v_extract_')) {
      return NextResponse.json(
        { error: msg === 't2v_extract_too_short' ? 'extract_failed' : msg },
        { status: 400 },
      )
    }
    return jsonError(err, 400)
  }
}
