import { agentLabErrorResponse, redactSecrets, runnerFetch } from '@/lib/server/agent-lab'

export const dynamic = 'force-dynamic'

/**
 * GB-14 proxy: /api/agent-lab/gb14/<path> -> runner /gb14/<path> (permissions, responsibilities, activity, needs you,
 * assignments, files, calendar, calls, knowledge, skills, templates). Contract: agentlab-takeover-kit/docs/GB14_API.md.
 * The runner token stays on this server. Permission writes are accepted by the runner only from this host.
 */
const SEGMENT = /^[A-Za-z0-9_.-]{1,120}$/
const ALLOWED_ROOTS = new Set([
  'permissions', 'overview', 'responsibilities', 'activity', 'needs-you', 'assignments', 'files', 'calendar', 'calls',
  'knowledge', 'skills', 'notifications', 'templates', 'dashboard',
])

function target(path: string[] | undefined, search: string): string | null {
  if (!path?.length || !ALLOWED_ROOTS.has(path[0]) || !path.every((s) => SEGMENT.test(s))) return null
  // The browser may not post customer-message directly; the chat send route records it server-side.
  if (path[0] === 'permissions' && path[1] === 'customer-message') return null
  return `/gb14/${path.map(encodeURIComponent).join('/')}${search}`
}

async function relay(res: Response): Promise<Response> {
  const text = await res.text()
  return new Response(redactSecrets(text), {
    status: res.status,
    headers: { 'Content-Type': res.headers.get('Content-Type') || 'application/json', 'Cache-Control': 'no-store' },
  })
}

export async function GET(request: Request, ctx: { params: Promise<{ path?: string[] }> }) {
  try {
    const { path } = await ctx.params
    const url = target(path, new URL(request.url).search)
    if (!url) return Response.json({ error: 'Not found' }, { status: 404 })
    return relay(await runnerFetch(url, { timeoutMs: 30_000 }))
  } catch (err) {
    return agentLabErrorResponse(err)
  }
}

export async function POST(request: Request, ctx: { params: Promise<{ path?: string[] }> }) {
  try {
    const { path } = await ctx.params
    const url = target(path, '')
    if (!url) return Response.json({ error: 'Not found' }, { status: 404 })
    const body = await request.text()
    if (body.length > 64_000) return Response.json({ error: 'Request too large' }, { status: 413 })
    return relay(await runnerFetch(url, { method: 'POST', body: body || '{}', timeoutMs: 90_000 }))
  } catch (err) {
    return agentLabErrorResponse(err)
  }
}
