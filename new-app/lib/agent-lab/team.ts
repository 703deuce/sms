/**
 * GB-18 team of named agents, business brain, goals and hand-offs (client side).
 * Runner contract: agentlab-takeover-kit/docs/GB14_API.md ("GB-18"), served through /api/agent-lab/gb14/*.
 */
export type TeamAgent = {
  id: string
  name: string
  role?: string | null
  instructions?: string | null
  avatar?: string | null
  color?: string | null
  model?: string | null
  phone_number?: string | null
  conversation_id?: string | null
  is_default: boolean
  status: string
  running?: boolean
  goals_active?: number
  handoffs_open?: number
  last_activity_at?: number | null
  own_skills?: number
  /** Newest readable message in its chat, for the agent list. */
  last_message?: { text: string; at: number; from: 'agent' | 'you' | 'teammate' } | null
}

export type AgentsDoc = { items: TeamAgent[]; default_id: string; split?: { shared: string[]; per_agent: string[] } }

export type BrainEntry = {
  id: string
  title?: string | null
  text: string
  category?: string | null
  source_agent?: string | null
  via?: string | null
  created_at: number
  updated_at: number
}

export type Goal = {
  id: string
  agent_id: string
  agent_name: string
  agent_avatar?: string | null
  title: string
  metric?: string | null
  unit?: string | null
  target: number | null
  current: number | null
  baseline?: number | null
  deadline?: string | null
  status: 'active' | 'achieved' | 'missed' | 'paused' | 'archived'
  responsibility_ids: string[]
  progress: number | null
  notes?: string | null
  created_at: number
  updated_at: number
  updates: { at: number; value: number | null; note: string; by: string }[]
}

export type Handoff = {
  id: string
  from_agent: string
  to_agent: string
  from_name: string
  to_name: string
  from_avatar?: string | null
  to_avatar?: string | null
  from_cid?: string | null
  to_cid?: string | null
  task: string
  status: 'queued' | 'delivering' | 'sent' | 'reported' | 'returning' | 'done' | 'failed' | 'cancelled'
  result?: string | null
  created_at: number
  sent_at?: number | null
  finished_at?: number | null
  delivered_at?: number | null
}

export const AVATARS = ['🧭', '📣', '🔎', '💼', '🛠️', '📊', '✍️', '📞', '🧾', '🎨', '🤝', '🗓️']

export const HANDOFF_OPEN = new Set(['queued', 'delivering', 'sent', 'reported', 'returning'])

export function handoffLabel(h: Handoff): string {
  if (h.status === 'queued' || h.status === 'delivering') return 'Handing over'
  if (h.status === 'sent') return 'Working on it'
  if (h.status === 'reported' || h.status === 'returning') return 'Sending result back'
  if (h.status === 'done') return 'Done'
  if (h.status === 'failed') return 'Not finished'
  return h.status
}

/** Header the runner puts on hand-off messages: "[Hand-off from X · dlg_id]" / "[Hand-off result from Y · dlg_id · done]". */
const HANDOFF_HEAD = /^\[Hand-off (result )?from (.+?) · (dlg_[A-Za-z0-9]+)(?: · ([a-z ]+))?\]\s*\n?/

export type HandoffMessage = { kind: 'request' | 'result'; from: string; id: string; state: string | null; body: string }

export function parseHandoff(text: string): HandoffMessage | null {
  const m = HANDOFF_HEAD.exec(text)
  if (!m) return null
  return { kind: m[1] ? 'result' : 'request', from: m[2], id: m[3], state: m[4] ?? null, body: text.slice(m[0].length).trim() }
}

export function agentHref(id: string): string {
  return `/app/agent-lab?agent=${encodeURIComponent(id)}`
}

export function goalPct(g: Goal): number | null {
  return g.progress == null ? null : Math.round(g.progress * 100)
}

export function fmtNum(n: number | null | undefined): string {
  if (n == null) return '—'
  return Number.isInteger(n) ? n.toLocaleString() : n.toLocaleString(undefined, { maximumFractionDigits: 2 })
}
