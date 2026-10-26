import { NextResponse } from 'next/server'
import { z } from 'zod'
import { jsonError } from '@/lib/server/api-error'
import { parseStreamUrl } from '@/lib/streamer/url'
import { resolveWorkspaceId } from '@/lib/server/workspace'

const bodySchema = z.object({ url: z.string().min(8).max(2000) })

export async function POST(request: Request) {
  try {
    await resolveWorkspaceId()
    const body = bodySchema.parse(await request.json())
    const parsed = parseStreamUrl(body.url)
    if ('error' in parsed) {
      return NextResponse.json({ error: parsed.error }, { status: 400 })
    }
    return NextResponse.json({
      data: {
        platform: parsed.platform,
        kind: parsed.kind,
        id: parsed.id,
        channel: parsed.channel,
        title: null,
        durationS: null,
        thumbnailUrl: null,
      },
    })
  } catch (err) {
    return jsonError(err, 400)
  }
}
