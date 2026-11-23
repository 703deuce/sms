import { agentLabErrorResponse, runnerFetch, runnerJson } from '@/lib/server/agent-lab'

export const dynamic = 'force-dynamic'

/** Live screen of the agent's desktop, served over transovo.ai: GET live (JPEG) | status. */
export async function GET(_request: Request, ctx: { params: Promise<{ action: string }> }) {
  try {
    const { action } = await ctx.params
    if (action === 'live') {
      const res = await runnerFetch('/desktop/live.jpg')
      if (!res.ok) return Response.json({ error: 'Live screen unavailable' }, { status: 503 })
      return new Response(res.body, { headers: { 'Content-Type': 'image/jpeg', 'Cache-Control': 'private, no-store' } })
    }
    if (action === 'status') return Response.json(await runnerJson('/desktop/status'))
    return Response.json({ error: 'Not found' }, { status: 404 })
  } catch (err) {
    return agentLabErrorResponse(err)
  }
}

/** Control the desktop: POST click {x,y,double?} | type {text, enter?} | key {key} | done (finish a sign-in handoff). */
export async function POST(request: Request, ctx: { params: Promise<{ action: string }> }) {
  try {
    const { action } = await ctx.params
    const b = (await request.json().catch(() => ({}))) as Record<string, unknown>
    let path: string
    let body: Record<string, unknown> = {}
    if (action === 'click') {
      const x = Math.round(Number(b.x)), y = Math.round(Number(b.y))
      if (!Number.isFinite(x) || !Number.isFinite(y) || x < 0 || y < 0 || x > 1920 || y > 1080) return Response.json({ error: 'Bad position' }, { status: 400 })
      path = '/desktop/click'
      body = { x, y, double: Boolean(b.double), button: b.button === 3 ? 3 : 1 }
    } else if (action === 'type') {
      path = '/desktop/type'
      body = { text: String(b.text ?? '').slice(0, 2000), enter: Boolean(b.enter) }
    } else if (action === 'key') {
      const key = String(b.key ?? '')
      if (!/^[A-Za-z0-9_+]{1,40}$/.test(key)) return Response.json({ error: 'Bad key' }, { status: 400 })
      path = '/desktop/key'
      body = { key }
    } else if (action === 'done') {
      path = '/desktop/handoff/done'
    } else {
      return Response.json({ error: 'Not found' }, { status: 404 })
    }
    return Response.json(await runnerJson(path, { method: 'POST', body: JSON.stringify(body) }))
  } catch (err) {
    return agentLabErrorResponse(err)
  }
}
