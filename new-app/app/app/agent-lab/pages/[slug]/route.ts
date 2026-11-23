import { servePageFile } from '@/lib/server/agent-lab-pages'

export const dynamic = 'force-dynamic'

/** A page the agent published: /workspace/pages/<slug>/index.html, served sandboxed. */
export async function GET(_request: Request, ctx: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await ctx.params
    return await servePageFile(slug, [])
  } catch {
    return new Response('Agent Lab is unavailable', { status: 502 })
  }
}
