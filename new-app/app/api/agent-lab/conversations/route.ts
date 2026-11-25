import { agentLabErrorResponse, agentLabJson, attachmentNote, conversationSettings, jobDir, readMessageRequest, redactSecrets, saveAttachments, userMessage, vaultSecretRefs } from '@/lib/server/agent-lab'
export const dynamic = 'force-dynamic'

type ConvInfo = {
  id: string
  title?: string | null
  execution_status?: string
  created_at?: string
  updated_at?: string
  current_model_id?: string | null
  agent?: { llm?: { model?: string | null } | null } | null
  tags?: Record<string, string> | null
}

export async function GET() {
  try {
    const page = await agentLabJson<{ items: ConvInfo[] }>('/api/conversations/search?limit=120&sort_order=CREATED_AT_DESC')
    const conversations = page.items
      .filter((c) => String(c.tags?.source ?? '') !== 'runner-helper')
      .slice(0, 50)
      .map((c) => ({
        id: c.id,
        title: redactSecrets(c.title || 'New conversation'),
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
    const { message: text, files } = await readMessageRequest(request)
    if (!text && !files.length) return Response.json({ error: 'Message is required' }, { status: 400 })
    const hooks = await agentLabJson<{ hook_config?: unknown }>('/api/hooks', {
      method: 'POST',
      body: JSON.stringify({ load_user_hooks: true, load_project_hooks: false }),
    })
    const id = crypto.randomUUID()
    const [settings, secrets] = await Promise.all([conversationSettings(id), vaultSecretRefs()])
    const saved = files.length ? await saveAttachments(id, files) : []
    const message = (text || 'Please look at the attached files.') + attachmentNote(saved)
    const conv = await agentLabJson<{ id: string }>('/api/conversations', {
      method: 'POST',
      body: JSON.stringify({
        conversation_id: id,
        agent_settings: settings.agentSettings,
        secrets,
        secrets_encrypted: true,
        hook_config: hooks.hook_config ?? null,
        workspace: { working_dir: jobDir(id) },
        max_iterations: settings.maxIterations,
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
