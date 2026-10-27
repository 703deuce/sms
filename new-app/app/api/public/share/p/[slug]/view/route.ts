import {
  handlePublicPublishViewBeacon,
  resolvePublishForSlug,
} from '@/lib/server/clips/public-share-view-beacon'

export async function POST(request: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params
  const resolved = await resolvePublishForSlug(slug)
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
