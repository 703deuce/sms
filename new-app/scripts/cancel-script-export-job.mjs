#!/usr/bin/env node
/** Mark script composition render + clip jobs cancelled (ops). */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function cancelRender(renderId, reason) {
  const render = await prisma.scriptCompositionRender.findUnique({ where: { id: renderId } })
  if (!render) {
    console.error('render not found', renderId)
    return false
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
    take: 50,
  })
  for (const j of jobs) {
    const p = j.payload
    if (p && typeof p === 'object' && p.renderId === renderId) {
      await prisma.clipJob.update({
        where: { id: j.id },
        data: { status: 'CANCELED', error: reason.slice(0, 500), lockedBy: null, lockedAt: null },
      })
      console.log('[canceled job]', j.id)
    }
  }
  console.log('[canceled render]', renderId)
  return true
}

async function cancelJobId(jobId, reason) {
  const job = await prisma.clipJob.findUnique({ where: { id: jobId } })
  if (!job) {
    console.error('job not found', jobId)
    return false
  }
  await prisma.clipJob.update({
    where: { id: jobId },
    data: { status: 'CANCELED', error: reason.slice(0, 500), lockedBy: null, lockedAt: null },
  })
  const p = job.payload
  if (p && typeof p === 'object' && p.renderId) {
    await prisma.scriptCompositionRender.updateMany({
      where: { id: p.renderId, status: { in: ['QUEUED', 'RENDERING'] } },
      data: { status: 'FAILED', error: reason.slice(0, 500) },
    })
  }
  console.log('[canceled job]', jobId)
  return true
}

async function main() {
  const reason = process.argv.find((a) => a.startsWith('--reason='))?.slice(9) || 'cancelled by owner'
  const args = process.argv.slice(2).filter((a) => !a.startsWith('--'))
  if (!args.length) {
    console.error('Usage: cancel-script-export-job.mjs <scrn_id|cjob_id> [...] [--reason=text]')
    process.exit(1)
  }
  for (const id of args) {
    if (id.startsWith('cjob_')) await cancelJobId(id, reason)
    else await cancelRender(id, reason)
  }
  await prisma.$disconnect()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
