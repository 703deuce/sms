import { agentLabErrorResponse, agentLabJson } from '@/lib/server/agent-lab'

export const dynamic = 'force-dynamic'

export async function POST(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params
    await agentLabJson(`/api/conversations/${encodeURIComponent(id)}/interrupt`, { method: 'POST' })
    return Response.json({ ok: true })
  } catch (err) {
    return agentLabErrorResponse(err)
  }
}
