#!/usr/bin/env node
/** Fail QUEUED/RUNNING RENDER_SCRIPT_COMPOSITION jobs whose render row is missing. */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const jobs = await prisma.clipJob.findMany({
    where: { type: 'RENDER_SCRIPT_COMPOSITION', status: { in: ['QUEUED', 'RUNNING'] } },
    orderBy: { createdAt: 'asc' },
  })
  let failed = 0
  for (const job of jobs) {
    const payload = job.payload && typeof job.payload === 'object' ? job.payload : {}
    const renderId = payload.renderId as string | undefined
    if (!renderId) continue
    const render = await prisma.scriptCompositionRender.findUnique({ where: { id: renderId } })
    if (render) continue
    await prisma.clipJob.update({
      where: { id: job.id },
      data: {
        status: 'FAILED',
        error: 'stale: render row missing (export idempotency bug)',
        finishedAt: new Date(),
      },
    })
    failed += 1
    console.log('[e2e] failed stale job', job.id, 'renderId', renderId)
  }
  console.log(`[e2e] done failed=${failed}`)
  await prisma.$disconnect()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
