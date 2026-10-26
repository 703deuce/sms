import { getBuiltInFormatSpec } from '@/lib/screenwriting/formats/feature'
import { emptyScreenplayDoc } from '@/lib/screenwriting/schema/empty-doc'
import { getPrisma } from '@/lib/server/db'
import type { SwProjectKind } from '@prisma/client'

export async function listSwProjects(ownerId: string) {
  const prisma = getPrisma()
  return prisma.swProject.findMany({
    where: { ownerId },
    orderBy: { updatedAt: 'desc' },
    include: {
      scripts: { select: { id: true, title: true, updatedAt: true }, orderBy: { updatedAt: 'desc' }, take: 1 },
    },
  })
}

export async function createSwProject(ownerId: string, title: string, kind: SwProjectKind = 'FEATURE') {
  const prisma = getPrisma()
  const spec = getBuiltInFormatSpec('feature')
  const pmJson = emptyScreenplayDoc()
  return prisma.$transaction(async (tx) => {
    const project = await tx.swProject.create({
      data: { ownerId, title, kind },
    })
    const script = await tx.swScript.create({
      data: {
        projectId: project.id,
        title: 'Untitled Script',
        templateKey: 'feature',
        formatSpec: spec,
        pmJson,
      },
    })
    return { project, script }
  })
}
