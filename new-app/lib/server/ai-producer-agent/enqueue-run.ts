import 'server-only'

import { createId } from '@/lib/supabase/id'
import { getPrisma } from '@/lib/server/db'
import { toPrismaJson } from '@/lib/server/clips/prisma-json'

export async function enqueueAiProducerRunJob(runId: string, projectId: string) {
  return getPrisma().clipJob.create({
    data: {
      id: createId('job'),
      projectId,
      type: 'AI_PRODUCER_AGENT_RUN',
      status: 'QUEUED',
      payload: toPrismaJson({ runId }),
    },
  })
}
