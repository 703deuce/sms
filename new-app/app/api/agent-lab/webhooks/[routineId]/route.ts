import { agentLabErrorResponse, runnerFetch } from '@/lib/server/agent-lab'

export const dynamic = 'force-dynamic'

/**
 * Webhook trigger for an Agent Lab routine: POST /api/agent-lab/webhooks/<routine id>
 * with header `X-Webhook-Secret: <secret>` (or `?secret=`). The body (≤64 KB) is passed to the run as data.
 */
export async function POST(request: Request, ctx: { params: Promise<{ routineId: string }> }) {
  try {
    const { routineId } = await ctx.params
    if (!/^rt_[0-9a-f]{10}$/.test(routineId)) return Response.json({ error: 'Unknown webhook' }, { status: 404 })
    const secret = request.headers.get('x-webhook-secret') ?? new URL(request.url).searchParams.get('secret') ?? ''
    if (!secret) return Response.json({ error: 'Missing secret' }, { status: 401 })
    const raw = await request.text()
    if (raw.length > 65_536) return Response.json({ error: 'Payload too large' }, { status: 413 })
    const res = await runnerFetch(`/webhook/${routineId}`, {
      method: 'POST',
      headers: { 'X-Webhook-Secret': secret, 'Content-Type': 'text/plain' },
      body: raw,
    })
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>
    if (!res.ok) return Response.json({ error: res.status === 404 ? 'Unknown webhook or bad secret' : String(data.error ?? 'Failed') }, { status: res.status === 404 ? 404 : res.status })
    return Response.json({ queued: true, runId: data.run_id }, { status: 202 })
  } catch (err) {
    return agentLabErrorResponse(err)
  }
}
