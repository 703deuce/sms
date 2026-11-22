import 'server-only'

/**
 * Transovo Agent Lab: server-side bridge to Rick's own OpenHands agent server.
 * AGENT_LAB_URL / AGENT_LAB_TOKEN stay on the server; the browser only talks to /api/agent-lab/*.
 */

export const AGENT_LAB_WORKDIR = '/workspace/project'

export class AgentLabError extends Error {
  constructor(message: string, public status = 502) {
    super(message)
  }
}

function config() {
  const url = process.env.AGENT_LAB_URL?.trim().replace(/\/+$/, '')
  const token = process.env.AGENT_LAB_TOKEN?.trim()
  if (!url || !token) throw new AgentLabError('Agent Lab is not configured on this server', 503)
  return { url, token }
}

export async function agentLabFetch(path: string, init: RequestInit & { timeoutMs?: number } = {}): Promise<Response> {
  const { url, token } = config()
  const headers = new Headers(init.headers)
  headers.set('X-Session-API-Key', token)
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json')
  const { timeoutMs = 30_000, ...rest } = init
  try {
    return await fetch(`${url}${path}`, { ...rest, headers, cache: 'no-store', signal: AbortSignal.timeout(timeoutMs) })
  } catch {
    throw new AgentLabError('Agent server unreachable')
  }
}

export async function agentLabJson<T = unknown>(path: string, init: RequestInit & { timeoutMs?: number } = {}): Promise<T> {
  const res = await agentLabFetch(path, init)
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new AgentLabError(`Agent server ${res.status}: ${text.slice(0, 300)}`, res.status >= 500 ? 502 : res.status)
  }
  return (await res.json()) as T
}

export function agentLabErrorResponse(err: unknown): Response {
  const status = err instanceof AgentLabError ? err.status : 500
  const message = err instanceof Error ? err.message : 'Agent Lab error'
  return Response.json({ error: message }, { status })
}

/** Paths the browser may read: files inside the agent's project folder only. */
export function safeWorkspacePath(raw: string | null): string | null {
  if (!raw) return null
  const p = raw.trim()
  if (!p.startsWith(`${AGENT_LAB_WORKDIR}/`) || p.includes('/../') || p.includes('\0') || p.endsWith('/..')) return null
  return p
}

// ---- Conversation events → compact chat items ----

export type AgentLabItem = {
  id: string
  ts: string
  type: 'message' | 'action' | 'observation' | 'error'
  role?: 'user' | 'agent'
  tool?: string
  title?: string
  text: string
  isError?: boolean
}

type RawEvent = Record<string, any>

function textOf(content: unknown): string {
  if (!Array.isArray(content)) return typeof content === 'string' ? content : ''
  return content
    .map((c: any) => (c && typeof c === 'object' && typeof c.text === 'string' ? c.text : ''))
    .filter(Boolean)
    .join('\n')
}

function clip(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n)}\n… (${s.length - n} more characters)` : s
}

function describeAction(e: RawEvent): { title: string; text: string } {
  const a = (e.action ?? {}) as Record<string, any>
  const tool = String(e.tool_name ?? a.kind ?? 'action')
  const summary = typeof e.summary === 'string' ? e.summary : ''
  if (tool === 'terminal') return { title: summary || 'Ran a command', text: String(a.command ?? '') }
  if (tool === 'file_editor') {
    const what = a.command === 'view' ? 'Viewed' : a.command === 'create' ? 'Created' : 'Edited'
    return { title: summary || `${what} ${a.path ?? 'a file'}`, text: String(a.path ?? '') }
  }
  if (tool.startsWith('browser')) {
    const detail = a.url ?? a.text ?? a.index ?? ''
    return { title: summary || tool.replace('browser_', 'Browser: ').replace(/_/g, ' '), text: String(detail) }
  }
  if (tool === 'task_tracker') {
    const tasks = Array.isArray(a.task_list) ? a.task_list.map((t: any) => `${t.status === 'done' ? '✓' : '•'} ${t.title ?? ''}`).join('\n') : ''
    return { title: summary || 'Updated the plan', text: tasks }
  }
  return { title: summary || tool, text: clip(JSON.stringify(a), 600) }
}

export function toAgentLabItems(events: RawEvent[]): AgentLabItem[] {
  const out: AgentLabItem[] = []
  for (const e of events) {
    const base = { id: String(e.id), ts: String(e.timestamp ?? '') }
    switch (e.kind) {
      case 'MessageEvent': {
        const text = textOf(e.llm_message?.content)
        if (!text) break
        out.push({ ...base, type: 'message', role: e.source === 'user' ? 'user' : 'agent', text })
        break
      }
      case 'ActionEvent': {
        const thought = textOf(e.thought).trim()
        if (e.tool_name === 'finish') {
          const msg = String(e.action?.message ?? thought ?? '')
          if (msg) out.push({ ...base, type: 'message', role: 'agent', text: msg })
          break
        }
        if (thought) out.push({ ...base, id: `${base.id}:t`, type: 'message', role: 'agent', text: thought })
        const { title, text } = describeAction(e)
        out.push({ ...base, type: 'action', tool: String(e.tool_name ?? ''), title, text })
        break
      }
      case 'ObservationEvent': {
        const o = e.observation ?? {}
        if (e.tool_name === 'finish') break
        const text = textOf(o.content)
        out.push({
          ...base,
          type: 'observation',
          tool: String(e.tool_name ?? ''),
          text: clip(text, 4000),
          isError: Boolean(o.is_error) || (typeof o.exit_code === 'number' && o.exit_code !== 0),
        })
        break
      }
      case 'AgentErrorEvent':
      case 'ConversationErrorEvent':
      case 'ServerErrorEvent':
        out.push({ ...base, type: 'error', text: clip(String(e.error ?? e.detail ?? e.message ?? 'Error'), 2000), isError: true })
        break
      default:
        break
    }
  }
  return out
}

export async function listConversationEvents(id: string, sinceTs?: string | null): Promise<RawEvent[]> {
  const events: RawEvent[] = []
  let pageId: string | null = null
  for (let i = 0; i < 30; i++) {
    const qs = new URLSearchParams({ limit: '100', sort_order: 'TIMESTAMP' })
    if (pageId) qs.set('page_id', pageId)
    if (sinceTs) qs.set('timestamp__gte', sinceTs)
    const page = await agentLabJson<{ items: RawEvent[]; next_page_id: string | null }>(
      `/api/conversations/${encodeURIComponent(id)}/events/search?${qs}`,
    )
    events.push(...page.items)
    pageId = page.next_page_id
    if (!pageId) break
  }
  return events
}

export function userMessage(text: string) {
  return { role: 'user', content: [{ type: 'text', text }], run: true }
}
