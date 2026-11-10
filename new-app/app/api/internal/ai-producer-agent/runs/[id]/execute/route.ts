import 'server-only'

import { NextResponse } from 'next/server'
import { verifyWorkerHmac } from '@/lib/server/clips/worker-auth'
import { runAiProducerAgent } from '@/lib/ai-producer-agent/orchestrator'
import { getPrisma } from '@/lib/server/db'
import { clipperStageLog } from '@/lib/ai-producer-agent/clip-mode/clipper-stage-log'

export const runtime = 'nodejs'
export const maxDuration = 1200

/** Durable worker entry: a duplicate HTTP request or retry must never fan
 * out a second copy of the same unified candidate set. */
export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const started = Date.now()
  const raw = await request.text()
  if (!verifyWorkerHmac(request, raw)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  const prisma = getPrisma()
  const run = await prisma.aiProducerAgentRun.findUnique({ where: { id } })
  if (!run) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  const unified = (run.config as { storyMode?: string } | null)?.storyMode === 'clip_unified_v1'
  const projectId = Array.isArray(run.sourceSnapshot)
    ? (run.sourceSnapshot[0] as { projectId?: string } | undefined)?.projectId
    : undefined
  if (unified) {
    const claimed = await prisma.aiProducerAgentRun.updateMany({
      where: { id, status: 'queued' },
      data: { status: 'running', phase: 'worker_claimed' },
    })
    if (!claimed.count) {
      clipperStageLog({
        stage: 'unified_worker_execute', action: 'duplicate_or_terminal_skipped',
        projectId, runId: id, status: run.status, elapsedMs: Date.now() - started,
      })
      return NextResponse.json({ ok: true, skipped: 'already_started_or_terminal' })
    }
    clipperStageLog({
      stage: 'unified_worker_execute', action: 'claimed', projectId, runId: id,
    })
  }
  try {
    await runAiProducerAgent(id)
    clipperStageLog({
      stage: 'unified_worker_execute', action: 'complete', projectId, runId: id,
      elapsedMs: Date.now() - started,
    })
    return NextResponse.json({ ok: true })
  } catch (err) {
    clipperStageLog({
      stage: 'unified_worker_execute', action: 'failed', projectId, runId: id,
      error: err, elapsedMs: Date.now() - started,
    })
    throw err
  }
}
