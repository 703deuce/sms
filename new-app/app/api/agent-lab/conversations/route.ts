import { agentLabErrorResponse, agentLabJson, AGENT_LAB_WORKDIR, userMessage } from '@/lib/server/agent-lab'

export const dynamic = 'force-dynamic'

type ConvInfo = { id: string; title?: string | null; execution_status?: string; created_at?: string; updated_at?: string }

export async function GET() {
  try {
    const page = await agentLabJson<{ items: ConvInfo[] }>('/api/conversations/search?limit=50&sort_order=CREATED_AT_DESC')
    const conversations = page.items.map((c) => ({
      id: c.id,
      title: c.title || 'New conversation',
      status: c.execution_status ?? 'idle',
      createdAt: c.created_at ?? null,
      updatedAt: c.updated_at ?? null,
    }))
    return Response.json({ conversations })
  } catch (err) {
    return agentLabErrorResponse(err)
  }
}

/** Start a conversation with the agent server's saved settings (model, instructions, skills). */
export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as { message?: string }
    const message = String(body.message ?? '').trim()
    if (!message) return Response.json({ error: 'Message is required' }, { status: 400 })
    const settings = await agentLabJson<{ agent_settings: unknown; conversation_settings?: { max_iterations?: number } }>(
      '/api/settings',
    )
    const conv = await agentLabJson<{ id: string }>('/api/conversations', {
      method: 'POST',
      body: JSON.stringify({
        agent_settings: settings.agent_settings,
        workspace: { working_dir: AGENT_LAB_WORKDIR },
        max_iterations: settings.conversation_settings?.max_iterations ?? 200,
        initial_message: userMessage(message),
        tags: { source: 'transovo-agent-lab' },
      }),
      timeoutMs: 60_000,
    })
    return Response.json({ id: conv.id })
  } catch (err) {
    return agentLabErrorResponse(err)
  }
}
