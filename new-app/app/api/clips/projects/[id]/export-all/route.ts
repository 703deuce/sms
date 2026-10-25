import { NextResponse } from 'next/server'
import { can } from '@/lib/billing/entitlements'
import { jsonError } from '@/lib/server/api-error'
import { listProjectClips } from '@/lib/server/clips/clips'
import { resolveWorkspaceId } from '@/lib/server/workspace'

/** Returns signed URLs for batch download (zip in browser via multiple files). */
export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params
    const workspaceId = await resolveWorkspaceId()
    const clips = await listProjectClips(workspaceId, id, 'score')
    if (!clips) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    const watermark = !can(workspaceId, 'no_watermark')
    const items = clips
      .filter((c) => c.previewUrl)
      .slice(0, 10)
      .map((c) => ({
        clipId: c.id,
        title: c.title,
        downloadUrl: c.previewUrl,
        filename: `${c.title.replace(/[^\w\s-]+/g, '').trim().replace(/\s+/g, '-') || 'clip'}.mp4`,
      }))
    return NextResponse.json({ data: { watermark, items } })
  } catch (err) {
    return jsonError(err, 400)
  }
}
