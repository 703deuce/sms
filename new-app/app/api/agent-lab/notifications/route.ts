import { agentLabErrorResponse, redactSecrets, runnerJson } from '@/lib/server/agent-lab'

export const dynamic = 'force-dynamic'

type Note = { id: number; kind: string; title: string; body: string | null; run_id: string | null; conversation_id: string | null; files: string[]; created_at: string; read_at: string | null }

/** Notifications feed: finished background/routine runs, reminders, failures, files. */
export async function GET() {
  try {
    const data = await runnerJson<{ items: Note[]; unread: number }>('/notifications')
    const items = data.items.map((n) => ({
      id: n.id,
      kind: n.kind,
      title: redactSecrets(n.title),
      body: redactSecrets(n.body ?? ''),
      conversationId: n.conversation_id,
      runId: n.run_id,
      files: Array.isArray(n.files) ? n.files.filter((f) => typeof f === 'string' && f.startsWith('/workspace/jobs/')) : [],
      createdAt: n.created_at,
      read: Boolean(n.read_at),
    }))
    return Response.json({ items, unread: data.unread })
  } catch (err) {
    return agentLabErrorResponse(err)
  }
}

/** Mark notifications read: `{ ids: number[] }`, or `{}` for all. */
export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as { ids?: unknown }
    const ids = Array.isArray(body.ids) ? body.ids.map(Number).filter((n) => Number.isInteger(n) && n > 0).slice(0, 200) : []
    await runnerJson('/notifications/read', { method: 'POST', body: JSON.stringify({ ids }) })
    return Response.json({ ok: true })
  } catch (err) {
    return agentLabErrorResponse(err)
  }
}
