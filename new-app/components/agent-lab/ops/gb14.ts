'use client'

/** Client helpers for the GB-14 API (agentlab-takeover-kit/docs/GB14_API.md) via /api/agent-lab/gb14/<path>. */

export type Mode = 'full' | 'selective' | 'supervised'
export type Decision = 'allow' | 'ask' | 'deny'

export type Policy = {
  id: string
  scope: 'agent' | 'app' | 'responsibility'
  app?: string
  label?: string
  responsibility_id?: string
  mode: Mode | null
  rules: Record<string, Decision>
  summary?: string
  via?: string
  updated_at?: number
}

export type SpendSummary = {
  limit: { id: string; app: string; target: string; label?: string; currency?: string; per_action_max?: number | null; period?: string; period_max?: number | null }
  period_key?: string
  actual_spend: number | null
  authorized_budget: number | null
  agent_increases?: number | null
  pending_changes?: number | null
  used?: number | null
  remaining?: number | null
}

export type PermissionsDoc = {
  default_mode: Mode
  agent: Policy | null
  apps: Policy[]
  responsibilities: Policy[]
  limits: SpendSummary[]
  standing_grants: { id: string; kind: string; app?: string; tool?: string; uses_left?: number }[]
  pending_approvals: number
  pending_changes: number
  browser_terminal?: { enabled: boolean; label?: string; warning?: string }
  categories?: { id: string; label: string }[]
  modes?: { id: Mode; label: string; text?: string }[]
  off?: boolean
}

export type Approval = {
  id: string
  status: string
  app?: string
  tool?: string
  title?: string
  category?: string
  consequence?: string
  reason?: string
  amount?: number | null
  created_at?: number
  choices?: { id: 'once' | 'always' | 'deny'; label: string }[]
}

export type PendingChange = { id: string; status: string; summary: string; loosens?: boolean; proposed_at?: number }

export type HistoryRow = { id: string; at: number; actor: string; via: string; action: string; summary: string }

export type Call = {
  id: string
  kind?: 'outbound' | 'inbound' | 'outgoing' | 'incoming' | string | null
  source?: 'receptionist' | 'agent' | string | null
  at: number
  ended_at?: number | null
  who?: string | null
  to?: string | null
  from?: string | null
  caller?: string | null
  caller_number?: string | null
  goal?: string | null
  status?: string | null
  outcome?: string | null
  summary?: string | null
  message?: string | null
  transcript?: string | null
  duration_s?: number | null
  after_hours?: boolean | null
  texts_sent?: number | null
  booked?: boolean | null
  needs_you?: boolean | null
}

export type CallsDoc = {
  items: Call[]
  receptionist?: { available?: boolean; source?: string | null; count?: number; source_note?: string | null }
  source_note?: string | null
}

export type KnowledgeItem = {
  id: string
  type?: string | null
  text: string
  source?: string | null
  created_at?: number
}

export type Skill = {
  id: string
  name: string
  description?: string | null
  modified_at?: number
}

export type Version = { version: number; at: number; by?: string; name?: string; cron?: string; prompt?: string }

export const gbUrl = (path: string) => `/api/agent-lab/gb14/${path}`

export async function gbPost<T = unknown>(path: string, body: unknown = {}): Promise<T> {
  const res = await fetch(gbUrl(path), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  const data = (await res.json().catch(() => ({}))) as T & { error?: string }
  if (!res.ok) throw new Error(data?.error || `Request failed (${res.status})`)
  return data
}

export const money = (n: number | null | undefined, cur = 'USD') =>
  n === null || n === undefined ? '—' : new Intl.NumberFormat('en-US', { style: 'currency', currency: cur, maximumFractionDigits: 2 }).format(n)

/** Times may arrive as Unix seconds (GB-14), milliseconds, or an ISO string. Never throw. */
export function fromUnix(t: number | string | null | undefined): string | null {
  if (t == null || t === '') return null
  if (typeof t === 'string' && Number.isNaN(Number(t))) {
    const d = new Date(t)
    return Number.isNaN(d.getTime()) ? null : d.toISOString()
  }
  const n = Number(t)
  if (!Number.isFinite(n) || n <= 0) return null
  const ms = n > 1e12 ? n : n * 1000
  const d = new Date(ms)
  try {
    return Number.isNaN(d.getTime()) ? null : d.toISOString()
  } catch {
    return null
  }
}

export const MODE_LABEL: Record<Mode, string> = { full: 'Full', selective: 'Selective', supervised: 'Supervised' }
