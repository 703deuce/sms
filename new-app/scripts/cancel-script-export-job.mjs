#!/usr/bin/env node
/** Mark a script composition render + clip job cancelled (ops; does not restart workers). */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const renderId = process.argv[2]
const reason = process.argv[3] || 'cancelled by ops'

async function main() {
  if (!renderId) {
    console.error('Usage: cancel-script-export-job.mjs <scrn_id> [reason]')
    process.exit(1)
  }
  const render = await prisma.scriptCompositionRender.findUnique({ where: { id: renderId } })
  if (!render) {
    console.error('render not found', renderId)
    process.exit(1)
  }
  await prisma.scriptCompositionRender.update({
    where: { id: renderId },
    data: { status: 'FAILED', error: reason.slice(0, 500) },
  })
  const jobs = await prisma.clipJob.findMany({
    where: {
      type: 'RENDER_SCRIPT_COMPOSITION',
      status: { in: ['QUEUED', 'RUNNING'] },
    },
    take: 20,
  })
  for (const j of jobs) {
    const p = j.payload as { renderId?: string } | null
    if (p?.renderId === renderId) {
      await prisma.clipJob.update({
        where: { id: j.id },
        data: { status: 'CANCELED', error: reason.slice(0, 500), lockedBy: null, lockedAt: null },
      })
      console.log('[canceled job]', j.id)
    }
  }
  console.log('[canceled render]', renderId)
  await prisma.$disconnect()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
