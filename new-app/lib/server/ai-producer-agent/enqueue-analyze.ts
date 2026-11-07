import 'server-only'

import { createId } from '@/lib/supabase/id'
import { getPrisma } from '@/lib/server/db'
import { toPrismaJson } from '@/lib/server/clips/prisma-json'
import type { AiProducerSourceRef } from '@/lib/ai-producer-agent/types'

export async function enqueueAiProducerAnalyzeJob(input: {
  runId: string
  projectId: string
  mode: 'best_moments' | 'story_search' | 'inventory' | 'visual_detail'
  sources: AiProducerSourceRef[]
  query?: string
  targetClipLenS?: number
  visualEvidence?: {
    enabled: boolean
    model?: string
    transcriptText?: string
    focusWindows?: Array<{ startMs:number; endMs:number; transcriptText:string }>
  }
}) {
  const prisma = getPrisma()
  const job = await prisma.clipJob.create({
    data: {
      id: createId('job'),
      projectId: input.projectId,
      type: 'AI_PRODUCER_AGENT_ANALYZE',
      status: 'QUEUED',
      payload: toPrismaJson({
        runId: input.runId,
        mode: input.mode,
        sources: input.sources,
        query: input.query,
        targetClipLenS: input.targetClipLenS,
        visualEvidence: input.visualEvidence,
      }),
    },
  })
  return job
}

export async function waitForClipJobDone(jobId: string, timeoutMs = 1_200_000) {
  const prisma = getPrisma()
  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    const job = await prisma.clipJob.findUnique({ where: { id: jobId } })
    if (!job) throw new Error('job_missing')
    if (job.status === 'DONE') return job
    if (job.status === 'FAILED') throw new Error(job.error || 'analyze_failed')
    await new Promise((r) => setTimeout(r, 2000))
  }
  throw new Error('analyze_timeout')
}
