import { agentLabErrorResponse, agentLabJson, listConversationEvents, redactSecrets, toAgentLabItems } from '@/lib/server/agent-lab'
import { conversationModel } from '@/lib/server/agent-lab-models'

export const dynamic = 'force-dynamic'

/** Conversation status plus chat items; `?since=<ISO timestamp>` returns only newer events. */
export async function GET(request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params
    const since = new URL(request.url).searchParams.get('since')
    const [info, events] = await Promise.all([
      agentLabJson<{ title?: string | null; execution_status?: string; stats?: any; current_model_id?: string | null; agent?: { llm?: { model?: string | null } | null } | null }>(`/api/conversations/${encodeURIComponent(id)}`),
      listConversationEvents(id, since),
    ])
    const lastTs = events.length ? String(events[events.length - 1].timestamp ?? '') : since
    return Response.json({
      id,
      title: redactSecrets(info.title || 'New conversation'),
      status: info.execution_status ?? 'idle',
      model: conversationModel(info),
      lastTs,
      items: toAgentLabItems(events),
    })
  } catch (err) {
    return agentLabErrorResponse(err)
  }
}
