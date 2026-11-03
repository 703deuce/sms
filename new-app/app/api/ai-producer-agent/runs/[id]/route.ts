import { NextResponse } from 'next/server'
import { aiProducerAgentDisabledResponse } from '@/lib/server/ai-producer-agent/api-guard'
import { jsonError } from '@/lib/server/api-error'
import { resolveWorkspaceId } from '@/lib/server/workspace'
import { cancelAiProducerAgentRun, getAiProducerAgentRun } from '@/lib/server/ai-producer-agent/runs'

type Params = { params: Promise<{ id: string }> }

export async function GET(_request: Request, { params }: Params) {
  const disabled = aiProducerAgentDisabledResponse()
  if (disabled) return disabled
  try {
    const { id } = await params
    const workspaceId = await resolveWorkspaceId()
    const run = await getAiProducerAgentRun(workspaceId, id)
    if (!run) return NextResponse.json({ error: 'not_found' }, { status: 404 })
    return NextResponse.json({ data: { run } })
  } catch (err) {
    return jsonError(err, 500)
  }
}

export async function POST(request: Request, { params }: Params) {
  const disabled = aiProducerAgentDisabledResponse()
  if (disabled) return disabled
  try {
    const { id } = await params
    const workspaceId = await resolveWorkspaceId()
    const body = (await request.json().catch(() => ({}))) as { action?: string }
    if (body.action === 'cancel') {
      const ok = await cancelAiProducerAgentRun(workspaceId, id)
      return NextResponse.json({ data: { canceled: ok } })
    }
    return jsonError(new Error('unknown_action'), 400)
  } catch (err) {
    return jsonError(err, 400)
  }
}
