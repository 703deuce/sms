#!/usr/bin/env node
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const renderId = process.argv[2]

async function main() {
  const rows = await prisma.scriptCompositionRender.findMany({
    orderBy: { createdAt: 'desc' },
    take: 5,
    select: { id: true, compositionId: true, workspaceId: true, status: true, settings: true, error: true },
  })
  console.log('recent', rows)
  if (renderId) {
    const one = await prisma.scriptCompositionRender.findUnique({ where: { id: renderId } })
    console.log('one', one)
  }
  await prisma.$disconnect()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
