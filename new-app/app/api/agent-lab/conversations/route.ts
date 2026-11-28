import { agentLabErrorResponse, agentLabJson, attachmentNote, readMessageRequest, recordCustomerMessage, redactSecrets, runnerJson, saveAttachments } from '@/lib/server/agent-lab'
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
    const page = await agentLabJson<{ items: ConvInfo[] }>('/api/conversations/search?limit=100&sort_order=CREATED_AT_DESC')
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
 * Start a conversation through the run daemon's normal start path (POST /runs on the runner), the same one server
 * jobs use: per-run settings and role trim, skill router + attached skills, vault refs, hooks, job folder marker,
 * run record (goal judge, skill gate, cost, learning, watchdog). The page picks the id first so attachments can be
 * uploaded into /workspace/jobs/<id>/inputs before the agent starts. `wait` returns once the run has started, so the
 * conversation exists when the page opens it.
 */
export async function POST(request: Request) {
  try {
    const { message: text, files, timezone, agentId } = await readMessageRequest(request)
    if (!text && !files.length) return Response.json({ error: 'Message is required' }, { status: 400 })
    const id = crypto.randomUUID()
    const saved = files.length ? await saveAttachments(id, files) : []
    const message = (text || 'Please look at the attached files.') + attachmentNote(saved)
    const run = await runnerJson<{ conversation_id: string; run_id: string; status?: string }>('/runs', {
      method: 'POST',
      body: JSON.stringify({
        prompt: message,
        source: 'user',
        conversation_id: id,
        created_by: 'transovo-page',
        wait: 120,
        // The browser's time zone: the runner saves it for this chat (clock line, reminders, routines). Eastern if missing.
        ...(timezone ? { timezone } : {}),
        // GB-18: the chat belongs to this named agent (its persistent thread). Missing = the main agent, as before.
        ...(agentId ? { agent_id: agentId, main: true } : {}),
      }),
      timeoutMs: 150_000,
    })
    if (text) recordCustomerMessage(run.conversation_id, text)
    return Response.json({ id: run.conversation_id, runId: run.run_id })
  } catch (err) {
    return agentLabErrorResponse(err)
  }
}
