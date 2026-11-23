import { pagesIndexResponse } from '@/lib/server/agent-lab-pages'

export const dynamic = 'force-dynamic'

/** Listing of pages the agent has published (from /workspace/pages/index.json). */
export async function GET() {
  try {
    return await pagesIndexResponse()
  } catch {
    return new Response('Agent Lab is unavailable', { status: 502 })
  }
}
