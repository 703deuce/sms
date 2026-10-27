import { NextResponse } from 'next/server'
import { z } from 'zod'
import { jsonError } from '@/lib/server/api-error'
import { enqueueCompositionSocialPublish } from '@/lib/server/clips/composition-social-publish'
import { resolveWorkspaceId } from '@/lib/server/workspace'

const bodySchema = z.object({
  platform: z.enum(['tiktok', 'youtube_shorts', 'instagram_reels']),
  caption: z.string().max(2200).optional(),
  title: z.string().max(200).optional(),
})

export async function POST(request: Request, ctx: { params: Promise<{ compositionId: string }> }) {
  try {
    const { compositionId } = await ctx.params
    const workspaceId = await resolveWorkspaceId()
    const body = bodySchema.parse(await request.json())
    const result = await enqueueCompositionSocialPublish(workspaceId, compositionId, body.platform, {
      caption: body.caption,
      title: body.title,
    })
    if (!result) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ data: result })
  } catch (err) {
    return jsonError(err, 400)
  }
}
