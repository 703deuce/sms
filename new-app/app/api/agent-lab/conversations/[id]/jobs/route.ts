import { agentLabErrorResponse, isConversationId, redactSecrets, runnerJson } from '@/lib/server/agent-lab'

export const dynamic = 'force-dynamic'

type RawJob = Record<string, unknown>

function jobName(j: RawJob): string {
  const n = j.name ?? j.job_name ?? j.title
  return typeof n === 'string' && n.trim() ? redactSecrets(n.trim()) : 'Background job'
}

function jobProgress(j: RawJob): string {
  for (const key of ['latest_progress', 'last_progress', 'progress', 'message', 'detail']) {
    const v = j[key]
    if (typeof v === 'string' && v.trim()) return redactSecrets(v.trim())
  }
  return ''
}

function jobElapsedSeconds(j: RawJob): number | null {
  if (typeof j.elapsed_seconds === 'number' && Number.isFinite(j.elapsed_seconds)) return Math.max(0, Math.round(j.elapsed_seconds))
  const started = typeof j.started_at === 'string' ? j.started_at : typeof j.created_at === 'string' ? j.created_at : null
  if (!started) return null
  const ms = Date.now() - Date.parse(started)
  if (!Number.isFinite(ms) || ms < 0) return null
  return Math.round(ms / 1000)
}

function normalizeJobs(data: unknown): { name: string; status: string; elapsedSeconds: number | null; progress: string }[] {
  const raw = Array.isArray(data) ? data : Array.isArray((data as { jobs?: unknown })?.jobs) ? (data as { jobs: unknown[] }).jobs : []
  return raw
    .filter((j): j is RawJob => j !== null && typeof j === 'object')
    .map((j) => ({
      name: jobName(j),
      status: String(j.status ?? j.state ?? 'unknown'),
      elapsedSeconds: jobElapsedSeconds(j),
      progress: jobProgress(j),
    }))
}

/** Background jobs for a conversation (runner queue on :8010). */
export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params
    if (!isConversationId(id)) return Response.json({ error: 'Invalid conversation id' }, { status: 400 })
    const data = await runnerJson<unknown>(`/jobs?conversation_id=${encodeURIComponent(id)}`)
    return Response.json({ jobs: normalizeJobs(data) })
  } catch (err) {
    return agentLabErrorResponse(err)
  }
}