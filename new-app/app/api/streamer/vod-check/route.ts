import { NextResponse } from 'next/server'
import { z } from 'zod'
import { jsonError } from '@/lib/server/api-error'
import { checkStreamUrlVodHealth } from '@/lib/server/streamer/vod-health'
import { resolveWorkspaceId } from '@/lib/server/workspace'

const bodySchema = z.object({ url: z.string().min(8).max(2000) })

export async function POST(request: Request) {
  try {
    await resolveWorkspaceId()
    const body = bodySchema.parse(await request.json())
    const data = await checkStreamUrlVodHealth(body.url.trim())
    return NextResponse.json({ data })
  } catch (err) {
    return jsonError(err, 400)
  }
}
