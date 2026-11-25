import { agentLabErrorResponse, isConversationId, runnerJson } from '@/lib/server/agent-lab'

export const dynamic = 'force-dynamic'

/** Cancel all background jobs for a conversation. */
export async function POST(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params
    if (!isConversationId(id)) return Response.json({ error: 'Invalid conversation id' }, { status: 400 })
    await runnerJson('/jobs/cancel', { method: 'POST', body: JSON.stringify({ conversation_id: id }) })
    return Response.json({ ok: true })
  } catch (err) {
    return agentLabErrorResponse(err)
  }
}