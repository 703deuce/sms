/**
 * Agent Lab work pages: shared types and pure helpers (no I/O), so pages and tests share one set of rules.
 * Data comes from GET /api/agent-lab/overview, which is built from the runner's runs, routines and open questions.
 */

export type OpsRun = {
  id: string
  source: string | null
  routineId: string | null
  helper: boolean
  title: string | null
  conversationId: string | null
  status: string
  attempts: number
  createdAt: string
  startedAt: string | null
  finishedAt: string | null
  progress: string | null
  error: string | null
}

export type OpsRoutine = {
  id: string
  name: string | null
  kind: string | null
  cron: string | null
  tz: string | null
  action: string | null
  instruction: string | null
  paused: boolean
  done: boolean
  nextRunAt: string | null
  lastRunAt: string | null
  lastRunId: string | null
}

export type OpsQuestion = {
  id: string
  runId: string | null
  conversationId: string | null
  title: string | null
  question: string
  choices: string[]
  createdAt: string
  expiresAt: string | null
}

export type Overview = {
  runs: OpsRun[] | null
  routines: OpsRoutine[] | null
  questions: OpsQuestion[] | null
}

export type ResponsibilityStatus = 'enabled' | 'working' | 'waiting' | 'paused' | 'blocked' | 'failed' | 'finished'
export type Tone = 'neutral' | 'info' | 'success' | 'warning' | 'danger' | 'muted'

export const RESPONSIBILITY_STATUS: Record<ResponsibilityStatus, { label: string; tone: Tone }> = {
  enabled: { label: 'Enabled', tone: 'success' },
  working: { label: 'Working', tone: 'info' },
  waiting: { label: 'Waiting on you', tone: 'warning' },
  paused: { label: 'Paused', tone: 'muted' },
  blocked: { label: 'Blocked', tone: 'danger' },
  failed: { label: 'Failed', tone: 'danger' },
  finished: { label: 'Finished', tone: 'neutral' },
}

const ACTIVE = new Set(['queued', 'running', 'waiting', 'starting'])

export function runState(status: string): 'working' | 'done' | 'failed' | 'stopped' | 'waiting' {
  if (status === 'waiting') return 'waiting'
  if (ACTIVE.has(status)) return 'working'
  if (status === 'failed' || status === 'error') return 'failed'
  if (status === 'stopped' || status === 'cancelled' || status === 'killed') return 'stopped'
  return 'done'
}

export const RUN_STATE_LABEL: Record<ReturnType<typeof runState>, { label: string; tone: Tone }> = {
  working: { label: 'Working', tone: 'info' },
  waiting: { label: 'Needs you', tone: 'warning' },
  done: { label: 'Done', tone: 'success' },
  failed: { label: 'Failed', tone: 'danger' },
  stopped: { label: 'Stopped', tone: 'muted' },
}

/** The one status a responsibility card shows, from its routine row, its runs and any open question. */
export function responsibilityStatus(r: OpsRoutine, runs: OpsRun[], questions: OpsQuestion[]): ResponsibilityStatus {
  if (r.done) return 'finished'
  if (r.paused) return 'paused'
  const mine = runs.filter((x) => x.routineId === r.id && !x.helper)
  if (questions.some((q) => mine.some((m) => m.id === q.runId))) return 'waiting'
  const latest = mine[0]
  if (latest) {
    const s = runState(latest.status)
    if (s === 'working') return 'working'
    if (s === 'waiting') return 'waiting'
    if (s === 'failed') return latest.attempts > 1 ? 'blocked' : 'failed'
  }
  return 'enabled'
}

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

function clock(h: number, m: number): string {
  const ampm = h >= 12 ? 'PM' : 'AM'
  const hh = h % 12 === 0 ? 12 : h % 12
  return `${hh}:${String(m).padStart(2, '0')} ${ampm}`
}

/** Plain-English schedule for a 5-field cron. Falls back to the raw text for shapes it does not know. */
export function cronToWords(cron: string | null, kind?: string | null): string {
  if (!cron) {
    if (kind === 'webhook' || kind === 'trigger') return 'When its trigger fires'
    if (kind === 'once') return 'Once'
    return 'When asked'
  }
  const parts = cron.trim().split(/\s+/)
  if (parts.length !== 5) return cron
  const [min, hour, dom, mon, dow] = parts
  const m = Number(min)
  const h = Number(hour)
  const fixedTime = /^\d+$/.test(min) && /^\d+$/.test(hour)
  if (/^\*\/(\d+)$/.test(min) && hour === '*' && dom === '*' && mon === '*' && dow === '*') {
    const n = Number(min.slice(2))
    return n === 1 ? 'Every minute' : `Every ${n} minutes`
  }
  if (/^\d+$/.test(min) && hour === '*' && dom === '*' && mon === '*' && dow === '*') return 'Every hour'
  if (/^\d+$/.test(min) && /^\*\/(\d+)$/.test(hour) && dom === '*' && mon === '*' && dow === '*') {
    return `Every ${Number(hour.slice(2))} hours`
  }
  if (fixedTime && dom === '*' && mon === '*') {
    const at = clock(h, m)
    if (dow === '*') return `Every day at ${at}`
    if (dow === '1-5') return `Every weekday at ${at}`
    if (dow === '0,6' || dow === '6,0') return `Every weekend day at ${at}`
    if (/^[0-7]$/.test(dow)) return `Every ${DAYS[Number(dow) % 7]} at ${at}`
    if (/^[0-7](,[0-7])+$/.test(dow)) return `Every ${dow.split(',').map((d) => DAYS[Number(d) % 7]).join(', ')} at ${at}`
  }
  if (fixedTime && /^\d+$/.test(dom) && mon === '*' && dow === '*') return `Monthly on day ${dom} at ${clock(h, m)}`
  return cron
}

export type RunGroup =
  | { kind: 'run'; run: OpsRun }
  | { kind: 'quiet'; key: string; title: string; runs: OpsRun[] }

const QUIET = /\b(nothing (new|found|to (do|report))|no (new|changes|results|matches|posts|leads|reviews))\b/i

/** True for a finished run that found nothing: done, no error, and its result line says nothing new. */
export function isQuietRun(r: OpsRun): boolean {
  return runState(r.status) === 'done' && !r.error && QUIET.test(r.progress ?? '')
}

/** Activity feed rows: consecutive "nothing found" checks of the same responsibility fold into one row. */
export function groupActivity(runs: OpsRun[], routineName: (id: string) => string | null): RunGroup[] {
  const out: RunGroup[] = []
  for (const run of runs) {
    if (run.helper) continue
    if (isQuietRun(run)) {
      const key = run.routineId ?? run.title ?? 'check'
      const prev = out[out.length - 1]
      if (prev && prev.kind === 'quiet' && prev.key === key) {
        prev.runs.push(run)
        continue
      }
      const name = (run.routineId && routineName(run.routineId)) || run.title || 'Check'
      out.push({ kind: 'quiet', key, title: name, runs: [run] })
      continue
    }
    out.push({ kind: 'run', run })
  }
  return out
}

/** One-off work given in chat: top-level runs that no responsibility started. */
export function assignments(runs: OpsRun[]): OpsRun[] {
  return runs.filter((r) => !r.helper && !r.routineId)
}

export function formatWhen(iso: string | null | undefined, now = new Date()): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  const sameDay = d.toDateString() === now.toDateString()
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  if (sameDay) return `Today, ${time}`
  const y = new Date(now)
  y.setDate(now.getDate() - 1)
  if (d.toDateString() === y.toDateString()) return `Yesterday, ${time}`
  const t = new Date(now)
  t.setDate(now.getDate() + 1)
  if (d.toDateString() === t.toDateString()) return `Tomorrow, ${time}`
  return `${d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}, ${time}`
}

export type CalendarEntry = { at: string; title: string; state: 'done' | 'failed' | 'working' | 'upcoming' | 'stopped' | 'waiting'; href?: string }

/** Calendar entries for a date range: finished and running runs, plus each routine's next run. */
export function calendarEntries(o: Overview, from: Date, to: Date): CalendarEntry[] {
  const inRange = (iso: string | null) => {
    if (!iso) return false
    const t = new Date(iso).getTime()
    return t >= from.getTime() && t < to.getTime()
  }
  const names = new Map((o.routines ?? []).map((r) => [r.id, r.name]))
  const out: CalendarEntry[] = []
  for (const r of o.runs ?? []) {
    if (r.helper) continue
    const at = r.startedAt ?? r.createdAt
    if (!inRange(at)) continue
    const s = runState(r.status)
    out.push({ at, title: (r.routineId && names.get(r.routineId)) || r.title || 'Task', state: s })
  }
  for (const r of o.routines ?? []) {
    if (r.paused || r.done || !inRange(r.nextRunAt)) continue
    out.push({ at: r.nextRunAt as string, title: r.name || 'Responsibility', state: 'upcoming' })
  }
  return out.sort((a, b) => a.at.localeCompare(b.at))
}

/** Failed top-level runs from the last three days: what "Needs you" lists as failures. */
export function recentFailures(runs: OpsRun[], now = Date.now()): OpsRun[] {
  const cutoff = now - 72 * 3600 * 1000
  return runs.filter((r) => !r.helper && runState(r.status) === 'failed' && new Date(r.finishedAt ?? r.createdAt).getTime() > cutoff)
}

export type DashboardSummary = {
  activeResponsibilities: number
  pausedResponsibilities: number
  workingNow: number
  openQuestions: number
  failures: OpsRun[]
  /** Latest finished results (done or failed), quiet "nothing new" checks left out. */
  recentResults: OpsRun[]
  quietChecks: number
  nextUp: { title: string; at: string } | null
}

/** The dashboard's "what's happening" numbers, all from the overview (runner runs, routines, questions). */
export function dashboardSummary(o: Overview, now = Date.now()): DashboardSummary {
  const runs = o.runs ?? []
  const routines = o.routines ?? []
  const questions = o.questions ?? []
  const statuses = routines.map((r) => responsibilityStatus(r, runs, questions))
  const top = runs.filter((r) => !r.helper)
  const finished = top
    .filter((r) => ['done', 'failed'].includes(runState(r.status)))
    .sort((a, b) => new Date(b.finishedAt ?? b.createdAt).getTime() - new Date(a.finishedAt ?? a.createdAt).getTime())
  const dayAgo = now - 24 * 3600 * 1000
  const next = routines
    .filter((r) => !r.paused && !r.done && r.nextRunAt && new Date(r.nextRunAt).getTime() >= now - 60_000)
    .sort((a, b) => new Date(a.nextRunAt!).getTime() - new Date(b.nextRunAt!).getTime())[0]
  return {
    activeResponsibilities: statuses.filter((s) => s !== 'paused' && s !== 'finished').length,
    pausedResponsibilities: statuses.filter((s) => s === 'paused').length,
    workingNow: top.filter((r) => runState(r.status) === 'working').length,
    openQuestions: questions.length,
    failures: recentFailures(runs, now),
    recentResults: finished.filter((r) => !isQuietRun(r)).slice(0, 6),
    quietChecks: finished.filter((r) => isQuietRun(r) && new Date(r.finishedAt ?? r.createdAt).getTime() > dayAgo).length,
    nextUp: next ? { title: next.name || 'Responsibility', at: next.nextRunAt! } : null,
  }
}

/** Link that opens a conversation in Agent Lab chat. */
export const chatHref = (conversationId: string | null | undefined) =>
  conversationId ? `/app/agent-lab?c=${encodeURIComponent(conversationId)}` : '/app/agent-lab'
