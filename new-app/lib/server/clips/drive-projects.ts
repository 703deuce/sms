import { getPrisma } from '@/lib/server/db'
import { listClipProjectsForPage } from '@/lib/server/clips/project-list'
import { createId } from '@/lib/supabase/id'

export async function listDriveProjects(
  workspaceId: string,
  opts: {
    q?: string
    status?: string
    folderId?: string | null
    view?: 'recent' | 'owned' | 'shared' | 'trash'
    sort?: 'lastViewed' | 'created' | 'name'
    userId?: string
  },
) {
  const prisma = getPrisma()
  const view = opts.view ?? 'recent'

  if (view === 'trash') {
    const rows = await prisma.clipProject.findMany({
      where: { workspaceId, deletedAt: { not: null } },
      orderBy: { updatedAt: 'desc' },
      take: 100,
    })
    return listClipProjectsForPage(workspaceId, { q: opts.q, status: opts.status, limit: 100 }).then((items) =>
      items.filter((p) => rows.some((r) => r.id === p.id)),
    )
  }

  const folderId = opts.folderId === 'root' ? null : opts.folderId ?? null

  const where: Record<string, unknown> = {
    workspaceId,
    deletedAt: null,
    folderId,
  }

  if (view === 'owned' && opts.userId) {
    where.createdById = opts.userId
  }

  const orderBy =
    opts.sort === 'name'
      ? { title: 'asc' as const }
      : opts.sort === 'created'
        ? { createdAt: 'desc' as const }
        : { lastViewedAt: 'desc' as const }

  await prisma.clipProject.findMany({ where, orderBy, take: 1 })

  return listClipProjectsForPage(workspaceId, {
    q: opts.q,
    status: opts.status,
    limit: 80,
  })
}

export async function touchProjectLastViewed(projectId: string, workspaceId: string) {
  const prisma = getPrisma()
  await prisma.clipProject.updateMany({
    where: { id: projectId, workspaceId },
    data: { lastViewedAt: new Date() },
  })
}

export async function createFolder(workspaceId: string, name: string, parentId?: string | null) {
  const prisma = getPrisma()
  return prisma.clipProjectFolder.create({
    data: {
      id: createId('cpf'),
      workspaceId,
      parentId: parentId ?? null,
      name: name.trim() || 'Untitled folder',
    },
  })
}

export async function listFolders(workspaceId: string, parentId?: string | null) {
  const prisma = getPrisma()
  return prisma.clipProjectFolder.findMany({
    where: { workspaceId, parentId: parentId ?? null, deletedAt: null },
    orderBy: { name: 'asc' },
  })
}

export async function moveProjectsToFolder(
  workspaceId: string,
  projectIds: string[],
  folderId: string | null,
) {
  const prisma = getPrisma()
  await prisma.clipProject.updateMany({
    where: { workspaceId, id: { in: projectIds } },
    data: { folderId },
  })
}

export async function softDeleteProjects(workspaceId: string, projectIds: string[]) {
  const prisma = getPrisma()
  await prisma.clipProject.updateMany({
    where: { workspaceId, id: { in: projectIds } },
    data: { deletedAt: new Date() },
  })
}

export async function restoreProjects(workspaceId: string, projectIds: string[]) {
  const prisma = getPrisma()
  await prisma.clipProject.updateMany({
    where: { workspaceId, id: { in: projectIds } },
    data: { deletedAt: null },
  })
}
