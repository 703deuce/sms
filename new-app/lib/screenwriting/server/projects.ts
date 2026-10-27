import { Prisma, type SwProjectKind } from '@prisma/client'
import { emptyScreenplayDoc } from '@/lib/screenwriting/schema/empty-doc'
import { getPrisma } from '@/lib/server/db'

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
        formatSpec: { key: 'feature' },
        pmJson,
      },
    })
    return { project, script }
  })
}

export async function createSwScriptInProject(
  projectId: string,
  ownerId: string,
  input: { title: string; pmJson: unknown; editorMeta?: Record<string, unknown> },
) {
  const prisma = getPrisma()
  const project = await prisma.swProject.findFirst({ where: { id: projectId, ownerId } })
  if (!project) throw new Error('Project not found')
  return prisma.swScript.create({
    data: {
      projectId,
      title: input.title,
      templateKey: 'feature',
      formatSpec: { key: 'feature' },
      pmJson: input.pmJson as object,
      editorMeta: (input.editorMeta ?? undefined) as Prisma.InputJsonValue | undefined,
    },
  })
}
