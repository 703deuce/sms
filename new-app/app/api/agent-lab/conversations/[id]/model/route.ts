import { agentLabErrorResponse, isConversationId } from '@/lib/server/agent-lab'
import { switchConversationModel } from '@/lib/server/agent-lab-models'

export const dynamic = 'force-dynamic'

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params
    if (!isConversationId(id)) return Response.json({ error: 'Invalid conversation id' }, { status: 400 })
    const body = (await request.json().catch(() => ({}))) as { model?: string }
    const model = String(body.model ?? '').trim()
    if (!model) return Response.json({ error: 'model is required' }, { status: 400 })
    const result = await switchConversationModel(id, model)
    return Response.json(result)
  } catch (err) {
    return agentLabErrorResponse(err)
  }
}
