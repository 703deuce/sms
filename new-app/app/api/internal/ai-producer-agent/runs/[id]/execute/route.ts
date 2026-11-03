import 'server-only'

import { NextResponse } from 'next/server'
import { verifyWorkerHmac } from '@/lib/server/clips/worker-auth'
import { runAiProducerAgent } from '@/lib/ai-producer-agent/orchestrator'
import { getPrisma } from '@/lib/server/db'

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const raw = await request.text()
  if (!verifyWorkerHmac(request, raw)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  const run = await getPrisma().aiProducerAgentRun.findUnique({ where: { id } })
  if (!run) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  await runAiProducerAgent(id)
  return NextResponse.json({ ok: true })
}
