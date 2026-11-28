import { runnerFetch } from '@/lib/server/agent-lab'

export const dynamic = 'force-dynamic'

const MAX_BODY = 1_000_000
const SIGNATURE_HEADERS = ['webhook-id', 'webhook-timestamp', 'webhook-signature'] as const

/**
 * Composio trigger + connection events: POST /api/agent-lab/composio/webhook (the project webhook subscription URL).
 * Composio cannot reach the Agent Lab runner (port 8010 is firewalled to this host), so this route forwards the raw
 * body and the three signature headers to the runner's existing webhook path, POST /webhook/composio. The runner has
 * the host broker check the HMAC signature, saves the event to its durable queue and answers at once; no agent work
 * happens inside this request. A non-2xx answer makes Composio retry, and the event id keeps retries harmless.
 */
export async function POST(request: Request) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  for (const name of SIGNATURE_HEADERS) {
    const v = request.headers.get(name)
    if (!v) return Response.json({ error: 'Missing signature' }, { status: 401 })
    headers[name] = v.slice(0, 2000)
  }
  const raw = await request.text()
  if (raw.length > MAX_BODY) return Response.json({ error: 'Payload too large' }, { status: 413 })
  try {
    const res = await runnerFetch('/webhook/composio', { method: 'POST', headers, body: raw, timeoutMs: 20_000 })
    const data = (await res.json().catch(() => ({}))) as { ok?: boolean; duplicate?: boolean; error?: string }
    if (res.status === 401) return Response.json({ error: 'Bad signature' }, { status: 401 })
    if (!res.ok) return Response.json({ error: 'Not accepted yet' }, { status: res.status >= 500 ? 503 : res.status })
    return Response.json({ ok: true, duplicate: Boolean(data.duplicate) })
  } catch {
    return Response.json({ error: 'Agent Lab is unavailable; retry later' }, { status: 503 })
  }
}
