import { agentLabErrorResponse, isConversationId, redactSecrets, runnerJson } from '@/lib/server/agent-lab'

export const dynamic = 'force-dynamic'

type RunnerJob = {
  n?: number
  name?: string
  status?: string
  progress?: string | null
  progress_at?: string | null
  started_at?: string | null
  finished_at?: string | null
  elapsed?: string | number | null
  cost?: number | null
}

type RunnerJobsPayload = { items?: RunnerJob[]; active?: number }

function formatElapsed(v: unknown): string {
  if (v == null) return '—'
  if (typeof v === 'string' && v.trim()) return redactSecrets(v.trim())
  if (typeof v === 'number' && Number.isFinite(v)) {
    const sec = Math.max(0, Math.round(v))
    if (sec < 60) return `${sec}s`
    const m = Math.floor(sec / 60)
    const s = sec % 60
    return s ? `${m}m ${s}s` : `${m}m`
  }
  return redactSecrets(String(v))
}

function normalizeJobs(data: RunnerJobsPayload) {
  const raw = Array.isArray(data.items) ? data.items : []
  const jobs = raw.map((j, i) => ({
    n: typeof j.n === 'number' && Number.isFinite(j.n) ? j.n : i + 1,
    name: typeof j.name === 'string' && j.name.trim() ? redactSecrets(j.name.trim()) : 'Background job',
    status: String(j.status ?? 'unknown'),
    progress: typeof j.progress === 'string' && j.progress.trim() ? redactSecrets(j.progress.trim()) : '',
    elapsed: formatElapsed(j.elapsed),
    cost: typeof j.cost === 'number' && Number.isFinite(j.cost) ? j.cost : null,
  }))
  const active = typeof data.active === 'number' && Number.isFinite(data.active) ? Math.max(0, Math.floor(data.active)) : 0
  return { jobs, active }
}

/** Background jobs for a conversation (runner queue on :8010). */
export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params
    if (!isConversationId(id)) return Response.json({ error: 'Invalid conversation id' }, { status: 400 })
    const data = await runnerJson<RunnerJobsPayload>(`/jobs?conversation_id=${encodeURIComponent(id)}`)
    return Response.json(normalizeJobs(data))
  } catch (err) {
    return agentLabErrorResponse(err)
  }
}