import { servePageFile } from '@/lib/server/agent-lab-pages'

export const dynamic = 'force-dynamic'

/** Assets next to a published page (images, css, data) under /workspace/pages/<slug>/. */
export async function GET(_request: Request, ctx: { params: Promise<{ slug: string; path: string[] }> }) {
  try {
    const { slug, path } = await ctx.params
    return await servePageFile(slug, path)
  } catch {
    return new Response('Agent Lab is unavailable', { status: 502 })
  }
}
