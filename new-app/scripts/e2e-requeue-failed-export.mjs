#!/usr/bin/env node
/** Re-queue FAILED script composition renders (creates new clip job). */
import { randomUUID } from 'node:crypto'
import { PrismaClient } from '@prisma/client'

function createId(prefix) {
  return `${prefix}_${randomUUID().replace(/-/g, '')}`
}

const prisma = new PrismaClient()
const renderId = process.argv[2]

async function main() {
  const where = renderId ? { id: renderId } : { status: 'FAILED' }
  const rows = await prisma.scriptCompositionRender.findMany({
    where,
    take: 5,
    orderBy: { updatedAt: 'desc' },
    include: { composition: { select: { projectId: true } } },
  })
  for (const r of rows) {
    await prisma.scriptCompositionRender.update({
      where: { id: r.id },
      data: { status: 'QUEUED', error: null, updatedAt: new Date() },
    })
    await prisma.clipJob.create({
      data: {
        id: createId('cjob'),
        projectId: r.composition.projectId,
        type: 'RENDER_SCRIPT_COMPOSITION',
        status: 'QUEUED',
        payload: { compositionId: r.compositionId, renderId: r.id },
      },
    })
    console.log('[requeue]', r.id)
  }
  await prisma.$disconnect()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
