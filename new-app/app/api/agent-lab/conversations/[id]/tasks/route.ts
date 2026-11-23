import { agentLabErrorResponse, agentLabJson, jobDir } from '@/lib/server/agent-lab'

export const dynamic = 'force-dynamic'

type Criterion = { id: string; text: string; status: string }
type Milestone = { id: string; text: string; status: string; criteria?: string[] }

/** The agent's task record (log/task.json): milestones as checklist items, each with its success criteria. */
export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params
    const dir = jobDir(id)
    if (!dir) return Response.json({ error: 'Invalid conversation id' }, { status: 400 })
    const out = await agentLabJson<{ stdout?: string | null }>('/api/bash/execute_bash_command', {
      method: 'POST',
      body: JSON.stringify({ command: `cat ${dir}/log/task.json 2>/dev/null`, timeout: 10 }),
    })
    let rec: { goal?: string; phase?: string; criteria?: Criterion[]; milestones?: Milestone[] } | null = null
    try {
      rec = JSON.parse(String(out.stdout ?? ''))
    } catch {
      return Response.json({ task: null })
    }
    const criteria = (rec?.criteria ?? []).map((c) => ({ id: c.id, text: c.text, status: c.status }))
    const milestones = (rec?.milestones ?? []).map((m) => ({ id: m.id, text: m.text, status: m.status, criteria: m.criteria ?? [] }))
    return Response.json({ task: { goal: rec?.goal ?? '', phase: rec?.phase ?? '', milestones, criteria } })
  } catch (err) {
    return agentLabErrorResponse(err)
  }
}
