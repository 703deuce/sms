import { agentLabErrorResponse, agentLabJson, jobDir, userMessage } from '@/lib/server/agent-lab'

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

/**
 * Start a conversation with the agent server's saved settings (model, instructions, skills).
 * Each conversation gets its own job folder (/workspace/jobs/<id>) and the server's hooks
 * (memory + skills auto-load, delete guard).
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as { message?: string }
    const message = String(body.message ?? '').trim()
    if (!message) return Response.json({ error: 'Message is required' }, { status: 400 })
    const settings = await agentLabJson<{ agent_settings: unknown; conversation_settings?: { max_iterations?: number } }>(
      '/api/settings',
    )
    const hooks = await agentLabJson<{ hook_config?: unknown }>('/api/hooks', {
      method: 'POST',
      body: JSON.stringify({ load_user_hooks: true, load_project_hooks: false }),
    })
    const id = crypto.randomUUID()
    const conv = await agentLabJson<{ id: string }>('/api/conversations', {
      method: 'POST',
      body: JSON.stringify({
        conversation_id: id,
        agent_settings: settings.agent_settings,
        hook_config: hooks.hook_config ?? null,
        workspace: { working_dir: jobDir(id) },
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
