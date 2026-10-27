import {
  handlePublicPublishViewBeacon,
  resolvePublishForShareLink,
} from '@/lib/server/clips/public-share-view-beacon'

export async function POST(request: Request, ctx: { params: Promise<{ linkId: string }> }) {
  const { linkId } = await ctx.params
  const resolved = await resolvePublishForShareLink(linkId)
  if (!resolved) {
    return new Response(JSON.stringify({ error: 'Not found' }), { status: 404 })
  }
  return handlePublicPublishViewBeacon(
    resolved.publishId,
    resolved.compositionId,
    resolved.workspaceId,
    request,
  )
}
