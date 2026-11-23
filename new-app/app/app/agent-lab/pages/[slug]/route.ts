import { SLUG } from '@/lib/server/agent-lab-pages'

export const dynamic = 'force-dynamic'

/** Public link for a published page; the page itself is served sandboxed from /api/agent-lab/pages/<slug>. */
export async function GET(_request: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params
  if (!SLUG.test(slug)) return new Response('Not found', { status: 404 })
  // Relative Location: behind the proxy request.url is the internal host, not transovo.ai.
  return new Response(null, { status: 307, headers: { Location: `/api/agent-lab/pages/${slug}`, 'Cache-Control': 'no-store' } })
}
