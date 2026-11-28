import { agentLabErrorResponse, runnerJson } from '@/lib/server/agent-lab'
import { clientIp, rateLimit, rateLimitedResponse } from '@/lib/server/agent-lab-rate-limit'

export const dynamic = 'force-dynamic'

/** Answer one open question the agent asked (Needs you page): `{ answer: string }`. */
export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    if (!rateLimit(`${clientIp(request)}:question-answer`, 20)) return rateLimitedResponse()
    const { id } = await ctx.params
    if (!/^[A-Za-z0-9_-]{1,80}$/.test(id)) return Response.json({ error: 'Invalid question' }, { status: 400 })
    const body = (await request.json().catch(() => ({}))) as { answer?: unknown }
    const answer = String(body.answer ?? '').trim().slice(0, 3000)
    if (!answer) return Response.json({ error: 'Answer required' }, { status: 400 })
    const data = await runnerJson<{ ok: boolean }>(`/questions/${encodeURIComponent(id)}/answer`, {
      method: 'POST',
      body: JSON.stringify({ answer }),
    })
    return Response.json({ ok: Boolean(data.ok) })
  } catch (err) {
    return agentLabErrorResponse(err)
  }
}
