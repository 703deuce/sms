import { agentLabErrorResponse, agentLabJson, listConversationEvents, redactSecrets, toAgentLabItems } from '@/lib/server/agent-lab'
import { conversationModel } from '@/lib/server/agent-lab-models'

export const dynamic = 'force-dynamic'

/**
 * The agent server stamps an event when it is CREATED but stores it when it is DONE, so a slow reply can be saved after
 * events that carry later stamps (an injected job result, hook events). Asking only for `timestamp >= newest seen`
 * then skipped it until a page reload. Ask for a trailing window instead; the client already drops items it has.
 */
const OVERLAP_MS = 180_000
function earlier(ts: string | null): string | null {
  if (!ts) return null
  const zoned = /[zZ]|[+-]\d\d:?\d\d$/.test(ts)
  const ms = Date.parse(zoned ? ts : `${ts}Z`)
  if (!Number.isFinite(ms)) return ts
  const iso = new Date(ms - OVERLAP_MS).toISOString()
  return zoned ? iso : iso.replace('Z', '')
}

/** Conversation status plus chat items; `?since=<ISO timestamp>` returns events newer than it (minus a safety window). */
export async function GET(request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params
    const since = new URL(request.url).searchParams.get('since')
    const [info, events] = await Promise.all([
      agentLabJson<{ title?: string | null; execution_status?: string; stats?: any; current_model_id?: string | null; agent?: { llm?: { model?: string | null } | null } | null }>(`/api/conversations/${encodeURIComponent(id)}`),
      listConversationEvents(id, earlier(since)),
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
