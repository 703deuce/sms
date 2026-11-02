import { getPrisma } from '@/lib/server/db'
import { listClipProjectsForPage } from '@/lib/server/clips/project-list'
import type { Prisma } from '@prisma/client'
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
    return listClipProjectsForPage(workspaceId, { q: opts.q, status: opts.status, limit: 100, trash: true })
  }

  const folderId = opts.folderId === 'root' ? null : opts.folderId ?? null

  return listClipProjectsForPage(workspaceId, {
    q: opts.q,
    status: opts.status,
    limit: 80,
    folderId,
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

export async function duplicateClipProjects(workspaceId: string, projectIds: string[]) {
  const prisma = getPrisma()
  const newProjectIds: string[] = []
  for (const id of projectIds) {
    const p = await prisma.clipProject.findFirst({
      where: { id, workspaceId, deletedAt: null },
    })
    if (!p) continue
    const newProjectId = createId('proj')
    await prisma.$transaction(async (tx) => {
      await tx.clipProject.create({
        data: {
          id: newProjectId,
          workspaceId,
          createdById: p.createdById,
          title: `${p.title} (copy)`,
          uploadId: p.uploadId,
          sourceUrl: p.sourceUrl,
          settings: (p.settings ?? {}) as Prisma.InputJsonValue,
          rangeStartMs: p.rangeStartMs,
          rangeEndMs: p.rangeEndMs,
          status: p.status,
          stage: p.stage,
          progress: p.progress,
          transcriptKey: p.transcriptKey,
          transcriptWords: p.transcriptWords ?? undefined,
          proxyKey: p.proxyKey,
          thumbKey: p.thumbKey,
          folderId: p.folderId,
        },
      })
      const clips = await tx.clip.findMany({
        where: { projectId: id, workspaceId, deletedAt: null },
      })
      if (clips.length) {
        await tx.clip.createMany({
          data: clips.map((c) => ({
            id: createId('clip'),
            projectId: newProjectId,
            workspaceId: c.workspaceId,
            title: c.title,
            reason: c.reason,
            startMs: c.startMs,
            endMs: c.endMs,
            segmentKey: c.segmentKey,
            score: c.score,
            scores: c.scores ?? {},
            cropKey: c.cropKey,
            wordsKey: c.wordsKey,
            previewKey: null,
            posterKey: c.posterKey,
            storageDriver: c.storageDriver,
            edits: c.edits ?? {},
            editsSaveVersion: c.editsSaveVersion,
            aiMeta: c.aiMeta ?? undefined,
            favorite: c.favorite,
            sourceSegKey: c.sourceSegKey,
            sourceSegStartMs: c.sourceSegStartMs,
            sourceSegEndMs: c.sourceSegEndMs,
          })),
        })
      }
    })
    newProjectIds.push(newProjectId)
  }
  return newProjectIds
}

export async function restoreProjects(workspaceId: string, projectIds: string[]) {
  const prisma = getPrisma()
  await prisma.clipProject.updateMany({
    where: { workspaceId, id: { in: projectIds } },
    data: { deletedAt: null },
  })
}
