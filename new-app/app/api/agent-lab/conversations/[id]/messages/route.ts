import { agentLabErrorResponse, agentLabJson, userMessage } from '@/lib/server/agent-lab'

export const dynamic = 'force-dynamic'

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params
    const body = (await request.json().catch(() => ({}))) as { message?: string }
    const message = String(body.message ?? '').trim()
    if (!message) return Response.json({ error: 'Message is required' }, { status: 400 })
    await agentLabJson(`/api/conversations/${encodeURIComponent(id)}/events`, {
      method: 'POST',
      body: JSON.stringify(userMessage(message)),
    })
    return Response.json({ ok: true })
  } catch (err) {
    return agentLabErrorResponse(err)
  }
}
