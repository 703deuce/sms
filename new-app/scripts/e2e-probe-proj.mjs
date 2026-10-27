#!/usr/bin/env node
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const id = process.argv[2] || 'proj_89c551'

async function main() {
  console.log('TRANSOVO_WORKSPACE_ID', process.env.TRANSOVO_WORKSPACE_ID || '(unset)')
  const proj = await prisma.clipProject.findFirst({ where: { id } })
  console.log('project', proj ? { id: proj.id, workspaceId: proj.workspaceId, title: proj.title } : null)
  const recent = await prisma.clipProject.findMany({
    take: 5,
    orderBy: { updatedAt: 'desc' },
    select: { id: true, workspaceId: true, title: true },
  })
  console.log('recent', recent)
  await prisma.$disconnect()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
