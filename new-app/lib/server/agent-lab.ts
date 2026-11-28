import 'server-only'

/**
 * Transovo Agent Lab: server-side bridge to Rick's own OpenHands agent server.
 * AGENT_LAB_URL / AGENT_LAB_TOKEN stay on the server; the browser only talks to /api/agent-lab/*.
 */

/** Each conversation works only in its own job folder: /workspace/jobs/<conversation id>. */
export const AGENT_LAB_JOBS_ROOT = '/workspace/jobs'
const LEGACY_WORKDIR = '/workspace/project'
const CONVERSATION_ID = /^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}$/i

export function isConversationId(id: string | null | undefined): id is string {
  return typeof id === 'string' && CONVERSATION_ID.test(id)
}

/** The job folder for a conversation (null for a malformed id). */
export function jobDir(id: string | null | undefined): string | null {
  return isConversationId(id) ? `${AGENT_LAB_JOBS_ROOT}/${id}` : null
}

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
  if (typeof init.body === 'string' && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json')
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

// ---- Run daemon (queue, routines, notifications, desktop) on the agent server, port 8010 ----

function runnerBase(): string {
  const explicit = process.env.AGENT_LAB_RUNNER_URL?.trim().replace(/\/+$/, '')
  if (explicit) return explicit
  const { url } = config()
  const u = new URL(url)
  u.port = '8010'
  return u.toString().replace(/\/+$/, '')
}

export async function runnerFetch(path: string, init: RequestInit & { timeoutMs?: number } = {}): Promise<Response> {
  const { token } = config()
  const headers = new Headers(init.headers)
  headers.set('X-Session-API-Key', token)
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json')
  const { timeoutMs = 20_000, ...rest } = init
  try {
    return await fetch(`${runnerBase()}${path}`, { ...rest, headers, cache: 'no-store', signal: AbortSignal.timeout(timeoutMs) })
  } catch {
    throw new AgentLabError('Agent Lab runner unreachable')
  }
}

export async function runnerJson<T = unknown>(path: string, init: RequestInit & { timeoutMs?: number } = {}): Promise<T> {
  const res = await runnerFetch(path, init)
  const data = (await res.json().catch(() => ({}))) as T & { error?: string }
  if (!res.ok) throw new AgentLabError(String(data?.error ?? `Runner ${res.status}`), res.status >= 500 ? 502 : res.status)
  return data
}

// ---- Output filter: redact anything that looks like a secret before it reaches the page ----

const SECRET_PATTERNS: RegExp[] = [
  /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g,
  /\bsk-(?:proj-|ant-)?[A-Za-z0-9_-]{16,}/g,
  /\bsk_[A-Za-z0-9]{20,}/g,
  /\bAIza[0-9A-Za-z_-]{30,}/g,
  /\bgh[pousr]_[A-Za-z0-9]{30,}/g,
  /\bgithub_pat_[A-Za-z0-9_]{30,}/g,
  /\bxai-[A-Za-z0-9]{20,}/g,
  /\br8_[A-Za-z0-9]{20,}/g,
  /\bxox[abprs]-[A-Za-z0-9-]{10,}/g,
  /\bAKIA[0-9A-Z]{16}\b/g,
  /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g,
  /(Bearer|Token)\s+[A-Za-z0-9._~+/-]{20,}=*/g,
]
const ASSIGNMENT = /\b([A-Z][A-Z0-9_]*(?:KEY|TOKEN|SECRET|PASSWORD|PASSWD|PWD))(["']?\s*[=:]\s*["']?)([^\s"',;]{8,})/g
const URL_SECRET = /([?&](?:key|token|api_key|apikey|access_token|secret|sig|signature|X-Amz-Signature|X-Amz-Credential)=)[^&\s"']+/gi

let knownValues: string[] | null = null
function knownSecretValues(): string[] {
  if (knownValues) return knownValues
  knownValues = Object.entries(process.env)
    .filter(([k, v]) => /KEY|TOKEN|SECRET|PASSWORD/i.test(k) && typeof v === 'string' && v.trim().length >= 16)
    .map(([, v]) => (v as string).trim())
    .sort((a, b) => b.length - a.length)
  return knownValues
}

export function redactSecrets(text: string): string {
  if (!text) return text
  let out = text
  for (const v of knownSecretValues()) if (out.includes(v)) out = out.split(v).join('[redacted]')
  for (const re of SECRET_PATTERNS) out = out.replace(re, '[redacted]')
  out = out.replace(ASSIGNMENT, (_m, name, sep) => `${name}${sep}[redacted]`)
  out = out.replace(URL_SECRET, (_m, p) => `${p}[redacted]`)
  return out
}

/** Paths the browser may read: files inside a conversation's job folder (or the legacy project folder) only. */
export function safeWorkspacePath(raw: string | null): string | null {
  if (!raw) return null
  const p = raw.trim()
  if (p.includes('\0') || p.split('/').some((seg) => seg === '..' || seg === '.')) return null
  const job = /^\/workspace\/jobs\/([^/]+)\/./.exec(p)
  if (job && isConversationId(job[1])) return p
  if (p.startsWith(`${LEGACY_WORKDIR}/`)) return p
  return null
}

// ---- Attachments: files Rick uploads go to <job folder>/inputs/ ----

export const MAX_ATTACHMENT_BYTES = 200 * 1024 * 1024
const IMAGE_EXT = /\.(png|jpe?g|webp|gif|heic|bmp)$/i

function safeFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? 'file'
  const clean = base.replace(/[^\w.\- ]+/g, '_').replace(/^\.+/, '').trim().slice(0, 120)
  return clean || 'file'
}

/** Uploads files into /workspace/jobs/<id>/inputs/ and returns the saved paths. */
export async function saveAttachments(conversationId: string, files: File[]): Promise<string[]> {
  const dir = jobDir(conversationId)
  if (!dir) throw new AgentLabError('Invalid conversation id', 400)
  const total = files.reduce((n, f) => n + f.size, 0)
  if (total > MAX_ATTACHMENT_BYTES) throw new AgentLabError('Attachments are too large (200 MB max per message)', 413)
  const used = new Set<string>()
  const paths: string[] = []
  for (const f of files) {
    let name = safeFileName(f.name)
    const dot = name.lastIndexOf('.')
    for (let i = 2; used.has(name.toLowerCase()); i++) name = dot > 0 ? `${name.slice(0, dot)}-${i}${name.slice(dot)}` : `${name}-${i}`
    used.add(name.toLowerCase())
    const path = `${dir}/inputs/${Date.now().toString(36)}-${name}`
    const form = new FormData()
    form.append('file', f, name)
    const res = await agentLabFetch(`/api/file/upload?path=${encodeURIComponent(path)}`, { method: 'POST', body: form, timeoutMs: 300_000 })
    if (!res.ok) throw new AgentLabError(`Upload failed for ${name} (${res.status})`)
    paths.push(path)
  }
  return paths
}

/** The note appended to Rick's message so the agent knows where the files are. */
export function attachmentNote(paths: string[]): string {
  if (!paths.length) return ''
  const lines = paths.map(
    (p) =>
      `- ${p}${IMAGE_EXT.test(p) ? ' (image: inspect it with `look`)' : /voice-memo-[^/]*\.(webm|m4a|ogg)$/i.test(p) ? ' (voice memo from Rick: run `transcribe` on it and treat the words as his message)' : ''}`,
  )
  return `\n\n[Rick attached ${paths.length === 1 ? 'a file' : `${paths.length} files`}, saved in your job folder]\n${lines.join('\n')}`
}

/** The browser's IANA time zone ("America/Chicago") if it looks like one; the runner validates it again. */
export function cleanTimeZone(raw: unknown): string | undefined {
  const tz = typeof raw === 'string' ? raw.trim() : ''
  if (!tz || tz.length > 64 || !/^[A-Za-z0-9_+-]+(\/[A-Za-z0-9_+-]+)*$/.test(tz)) return undefined
  return tz
}

/** Reads `{ message, files[], timezone }` from either JSON or multipart form data. */
export async function readMessageRequest(request: Request): Promise<{ message: string; files: File[]; timezone?: string }> {
  const type = request.headers.get('content-type') ?? ''
  if (type.includes('multipart/form-data')) {
    const form = await request.formData()
    const files = form.getAll('files').filter((f): f is File => typeof f === 'object' && f !== null && 'arrayBuffer' in f)
    return { message: String(form.get('message') ?? '').trim(), files, timezone: cleanTimeZone(form.get('timezone')) }
  }
  const body = (await request.json().catch(() => ({}))) as { message?: string; timezone?: string }
  return { message: String(body.message ?? '').trim(), files: [], timezone: cleanTimeZone(body.timezone) }
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
  /** Runner-injected user lines (helpers, front desk, job status) — not Rick's chat bubbles. */
  systemNote?: boolean
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

// The runner wraps everything it adds around the user's own words (intent line, pinned requirements, attached skills) in
// <runner-context>…</runner-context>. Show only the user's text: drop those blocks structurally, never edit the text itself.
const RUNNER_CONTEXT_BLOCK = /<runner-context>[\s\S]*?<\/runner-context>\s*/g
// Messages saved before the tags existed: the runner's exact heading, and leading paragraphs that open with a runner tag.
const LEGACY_SKILLS_HEADING = '\n\n## Skills attached for this task (by the runner)'
const LEGACY_RUNNER_PARAGRAPH = /^\[(?:Intent|Ask first|Skill router|Required first, checked by the runner|Requirements from the user, verbatim, pinned by the runner|Delivery check)\b/

function stripRunnerContext(text: string): string {
  if (text.includes('<runner-context>')) return text.replace(RUNNER_CONTEXT_BLOCK, '').trim()
  const cut = text.indexOf(LEGACY_SKILLS_HEADING)
  let t = cut >= 0 ? text.slice(0, cut) : text
  if (cut < 0 && !LEGACY_RUNNER_PARAGRAPH.test(t)) return text
  const paras = t.split(/\n{2,}/)
  while (paras.length && LEGACY_RUNNER_PARAGRAPH.test(paras[0])) paras.shift()
  t = paras.join('\n\n')
  return t.trim()
}

const RUNNER_USER_NOTE = /^\[(?:Sent by|Background job|Front desk|Helper|Message from)/

function isRunnerInjectedUserMessage(e: RawEvent, text: string): boolean {
  if (e.source !== 'user') return false
  if (typeof e.sender === 'string' && e.sender.startsWith('conversation:')) return true
  return RUNNER_USER_NOTE.test(text)
}

const RAW_TOOL_SUMMARY = /^[A-Za-z0-9_.-]+:\s*[{[]/
const INTERNAL_ID = /\b(?:rt|ti|rm|run|ca)_[A-Za-z0-9_-]+/
const PROVIDER_SLUG = /\b[A-Z]{3,}_[A-Z0-9_]{8,}\b/

/** Folder / query wording customers should never see in step titles or the job status bar. */
const INTERNAL_JARGON =
  /\bGAQL\b|\/workspace\/jobs\/|\b(?:out|log|helpers)\/|\b(?:job|log|out|helpers?) folder\b|\btask file\b|\btask\.md\b|\blog file\b/i

function hasInternalWording(title: string): boolean {
  const t = title.trim()
  if (!t) return true
  if (RAW_TOOL_SUMMARY.test(t)) return true
  if (/"command"\s*:/.test(t)) return true
  if (INTERNAL_ID.test(t) || PROVIDER_SLUG.test(t)) return true
  if (INTERNAL_JARGON.test(t)) return true
  return false
}

/** True when a tool summary is the raw fallback (tool name + JSON/ids), not a short plain label. */
function isRawStepTitle(title: string): boolean {
  return hasInternalWording(title)
}

/**
 * Rewrite a customer-visible step or status-bar label that still has internal wording.
 * Returns the original text when it is already plain, a mapped phrase when we can tell
 * what happened, or '' so the caller can fall back (for example to the command).
 */
export function plainCustomerLabel(text: string): string {
  const t = String(text || '').trim()
  if (!t) return ''
  const lower = t.toLowerCase()
  if (/\b(job start|start(?:ed|ing)? (a )?background job)\b/.test(lower)) return 'Started a background job'
  if (!hasInternalWording(t)) return t
  if (/\b(task file|task\.md|background task)\b/.test(lower)) return 'Prepared the background job'
  if (/\b(to out\/?|out\/|saved results|write result|result files|connector output)\b/.test(lower)) return 'Saved results'
  if (/\b(job folder|log folder|log file|helpers? folder|parent job folder)\b/.test(lower)) {
    return /\b(check|inspect|list|look|verify)\b/.test(lower) ? 'Checked the work' : 'Prepared the background job'
  }
  if (/\bGAQL\b/i.test(t)) return /\b(check|inspect|verify|review)\b/.test(lower) ? 'Checked the results' : 'Used a connected app'
  return ''
}

function skillDisplayName(name: string): string {
  const pretty = name.replace(/^lab-/, '').replace(/[_-]+/g, ' ').trim()
  return pretty ? `Loaded the ${pretty} skill` : 'Loaded a skill'
}

function oneCommandLabel(raw: string): string {
  const cmd = raw
    .replace(/^\s*(?:\d*>\s*\S+\s*)+/, '')
    .replace(/[0-9]*[>&].*$/, '')
    .trim()
  if (!cmd) return ''
  const tokens = cmd.split(/\s+/).filter((t) => t && t !== 'sudo')
  const bin = (tokens[0]?.split('/').pop() || '').replace(/`/g, '')
  if (!bin || ['echo', 'head', 'grep', 'tail', 'awk', 'sed', 'cat', 'true', 'ls', 'pwd', 'cd', 'wc', 'date'].includes(bin)) return ''
  if (tokens.includes('--help') || tokens.includes('-h')) return 'Checked command help'
  if (bin === 'job') {
    const sub = tokens[1] || ''
    if (sub === 'start') return 'Started a background job'
    if (sub === 'steer') return 'Updated the background job'
    if (sub === 'cancel') return 'Canceled a background job'
    if (sub === 'list' || sub === 'status') return 'Checked the background job'
    return 'Updated a background job'
  }
  if (bin === 'checkpoint') return 'Saved progress'
  if ((bin === 'cp' || bin === 'tee' || bin === 'install' || bin === 'mv') && /(?:^|\s)(?:out|log)\//.test(cmd)) return 'Saved results'
  if (bin === 'mkdir' && /\b(?:log|out|helpers)\b/.test(cmd)) return 'Prepared the background job'
  if (bin === 'connector') {
    const sub = tokens[1] || ''
    const map: Record<string, string> = {
      'trigger-pause': 'Paused a trigger',
      'trigger-resume': 'Resumed a trigger',
      'trigger-list': 'Listed triggers',
      'trigger-create': 'Created a trigger',
      'trigger-delete': 'Deleted a trigger',
      'trigger-auto-do': 'Updated automatic actions',
      'trigger-info': 'Looked up a trigger',
      'trigger-events': 'Listed trigger events',
      'trigger-retry': 'Retried a trigger event',
      triggers: 'Listed trigger types',
      tools: "Looked up an app's tools",
      tool: 'Looked up an app tool',
      schema: 'Looked up an app tool',
      call: 'Used a connected app',
      status: 'Checked connected apps',
      connected: 'Checked connected apps',
      link: 'Started an app connection',
      connect: 'Connected an app',
      disconnect: 'Removed a connection',
      reconnect: 'Started a reconnection',
      'auth-fields': 'Checked how to connect an app',
      auth_fields: 'Checked how to connect an app',
      fields: 'Checked how to connect an app',
      usage: 'Looked up connection info',
    }
    return map[sub] || 'Used a connected app'
  }
  if (bin === 'routine') {
    const sub = tokens[1] || ''
    const map: Record<string, string> = {
      pause: 'Paused a routine',
      resume: 'Resumed a routine',
      list: 'Listed routines',
      show: 'Looked up a routine',
      add: 'Added a routine',
      rm: 'Removed a routine',
      run: 'Ran a routine',
      'auto-do': 'Updated automatic actions',
    }
    return map[sub] || 'Updated a routine'
  }
  if (bin === 'remind') return 'Set a reminder'
  return 'Ran a command'
}

function plainTerminalTitle(command: string): string {
  const parts = String(command || '')
    .split(/&&|\|\||;/)
    .map((s) => oneCommandLabel(s))
    .filter(Boolean)
  const unique = [...new Set(parts)]
  if (unique.length === 0) return 'Ran a command'
  if (unique.length === 1) return unique[0]
  if (unique.length === 2) return `${unique[0]} and ${unique[1].charAt(0).toLowerCase()}${unique[1].slice(1)}`
  return unique[0]
}

function plainStepTitle(tool: string, summary: string, action: Record<string, any>): string {
  const command = String(action.command ?? '')
  const path = String(action.path ?? '')
  if (tool === 'terminal' && /\bjob\s+start\b/.test(command)) return 'Started a background job'
  if (tool === 'file_editor' && /(?:\/|^)log\/task\.md$|\btask\.md\b|background task file/i.test(`${path} ${summary}`)) {
    return action.command === 'view' ? 'Checked the background job' : 'Prepared the background job'
  }
  if (summary && !isRawStepTitle(summary)) return summary
  const mapped = summary ? plainCustomerLabel(summary) : ''
  if (mapped) return mapped
  if (tool === 'terminal') {
    const fromCmd = plainTerminalTitle(command)
    if (fromCmd === 'Ran a command' && /(?:^|\s)(?:out|log)\//.test(command)) return 'Saved results'
    return fromCmd
  }
  if (tool === 'agent_skill' || tool === 'skill') {
    const name = String(action.data?.name ?? action.name ?? '')
    const fromSummary = summary.match(/"name"\s*:\s*"([^"]+)"/)
    return skillDisplayName(name || fromSummary?.[1] || '')
  }
  if (tool === 'file_editor') {
    const what = action.command === 'view' ? 'Viewed a file' : action.command === 'create' ? 'Created a file' : 'Edited a file'
    return what
  }
  return 'Used a tool'
}

function describeAction(e: RawEvent): { title: string; text: string } {
  const a = (e.action ?? {}) as Record<string, any>
  const tool = String(e.tool_name ?? a.kind ?? 'action')
  const summary = typeof e.summary === 'string' ? e.summary : ''
  const title = plainStepTitle(tool, summary, a)
  if (tool === 'terminal') return { title, text: String(a.command ?? '') }
  if (tool === 'file_editor') {
    return { title, text: String(a.path ?? '') }
  }
  if (tool.startsWith('browser')) {
    const detail = a.url ?? a.text ?? a.index ?? ''
    const fallback = tool.replace('browser_', 'Browser: ').replace(/_/g, ' ')
    return { title: isRawStepTitle(summary) ? fallback : title, text: String(detail) }
  }
  if (tool === 'task_tracker') {
    const tasks = Array.isArray(a.task_list) ? a.task_list.map((t: any) => `${t.status === 'done' ? '✓' : '•'} ${t.title ?? ''}`).join('\n') : ''
    return { title: isRawStepTitle(summary) ? 'Updated the plan' : title, text: tasks }
  }
  return { title: isRawStepTitle(summary) ? (tool === 'agent_skill' ? title : tool) : title, text: clip(JSON.stringify(a), 600) }
}

export function toAgentLabItems(events: RawEvent[]): AgentLabItem[] {
  return rawItems(events).map((i) => ({ ...i, text: redactSecrets(i.text), title: i.title ? (plainCustomerLabel(redactSecrets(i.title)) || (hasInternalWording(i.title) ? 'Used a tool' : redactSecrets(i.title))) : i.title }))
}

function rawItems(events: RawEvent[]): AgentLabItem[] {
  const out: AgentLabItem[] = []
  for (const e of events) {
    const base = { id: String(e.id), ts: String(e.timestamp ?? '') }
    switch (e.kind) {
      case 'MessageEvent': {
        const rawText = textOf(e.llm_message?.content)
        const text = e.source === 'user' ? stripRunnerContext(rawText) : rawText
        if (!text) break
        if (e.source === 'environment') {
          // Auto-loaded session context (job folder rule, memory, skills index): show collapsed.
          out.push({ ...base, type: 'observation', tool: 'context', title: 'Loaded memory and skills', text: clip(text, 6000) })
          break
        }
        if (e.source === 'user' && text.startsWith('[view] ')) {
          // Images the agent asked to see with its `view` tool (posted by the runner, not typed by Rick).
          out.push({ ...base, type: 'observation', tool: 'view', title: 'Agent looked at images', text: clip(text, 2000) })
          break
        }
        if (isRunnerInjectedUserMessage(e, text)) {
          // Runner-injected mid-run lines (front-desk nudge, job status, helper marks). Hidden on the page;
          // the agent still sees them in the conversation. Tagged <runner-context> messages already
          // stripped to empty above and were skipped.
          break
        }
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
        // Action-event thoughts are the model's scratch notes, not customer messages.
        // Showing them produced extra mid-turn progress lines ("I'll list…", "leaving this to a background job…").
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
      case 'UserRejectObservation':
        out.push({
          ...base,
          type: 'error',
          title: 'Blocked by safety guard',
          text: clip(String(e.rejection_reason ?? 'Blocked'), 2000),
          isError: true,
        })
        break
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

export function userMessage(text: string, run = true) {
  return { role: 'user', content: [{ type: 'text', text }], run }
}

// ---- Conversation settings: saved agent settings + this conversation's job folder for the Agent Lab MCP tools + vault refs ----

type McpServer = { command?: string; args?: string[]; [k: string]: unknown }
type AgentSettings = { mcp_config?: Record<string, McpServer> | null; [k: string]: unknown }

/**
 * The saved settings in encrypted form (MCP env/headers stay as ciphertext the agent server can decrypt, instead of
 * the redacted '**********' a plain GET returns), with the built-in `agent` MCP server pointed at this job folder.
 */
export async function conversationSettings(id: string, model?: string | null) {
  const settings = await agentLabJson<{ agent_settings: AgentSettings; conversation_settings?: { max_iterations?: number } }>(
    '/api/settings',
    { headers: { 'X-Expose-Secrets': 'encrypted' } },
  )
  const agent = { ...settings.agent_settings }
  const dir = jobDir(id)
  if (agent.mcp_config?.agent && dir) {
    agent.mcp_config = { ...agent.mcp_config, agent: { ...agent.mcp_config.agent, args: ['--job', dir] } }
  }
  if (model) {
    const { llmConfigForModel } = await import('@/lib/server/agent-lab-models')
    agent.llm = await llmConfigForModel(model)
  }
  return { agentSettings: agent, maxIterations: settings.conversation_settings?.max_iterations ?? 200 }
}

/** Vault entries as lazy references the agent server resolves in-process; no value passes through this app. */
export async function vaultSecretRefs(): Promise<Record<string, { kind: 'LookupSecret'; url: string; description: string }>> {
  const base = process.env.AGENT_LAB_INTERNAL_URL?.trim().replace(/\/+$/, '') || 'http://127.0.0.1:8000'
  try {
    const data = await agentLabJson<{ secrets?: { name: string }[] }>('/api/settings/secrets')
    return Object.fromEntries(
      (data.secrets ?? []).map((s) => [s.name, { kind: 'LookupSecret' as const, url: `${base}/api/settings/secrets/${s.name}`, description: 'from the Agent Lab vault' }]),
    )
  } catch {
    return {}
  }
}
