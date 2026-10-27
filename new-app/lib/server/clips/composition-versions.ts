import 'server-only'
import { Prisma } from '@prisma/client'
import { createId } from '@/lib/supabase/id'
import { getPrisma } from '@/lib/server/db'
import type { ScriptDocumentV1 } from '@/lib/clips/script-edl/types'
import {
  getCompositionForWorkspace,
  parseScriptCompositionDocument,
} from '@/lib/server/clips/script-composition'

export const AUTO_VERSION_EVERY = 8

export async function listCompositionVersions(workspaceId: string, compositionId: string) {
  const row = await getCompositionForWorkspace(workspaceId, compositionId)
  if (!row) return null
  const prisma = getPrisma()
  return prisma.scriptCompositionVersion.findMany({
    where: { compositionId },
    orderBy: { createdAt: 'desc' },
    take: 100,
    select: {
      id: true,
      revision: true,
      name: true,
      auto: true,
      createdAt: true,
    },
  })
}

export async function createCompositionVersion(
  workspaceId: string,
  compositionId: string,
  name?: string,
) {
  const row = await getCompositionForWorkspace(workspaceId, compositionId)
  if (!row) return null
  const prisma = getPrisma()
  const id = createId('scvr')
  await prisma.scriptCompositionVersion.create({
    data: {
      id,
      compositionId,
      revision: row.revision,
      name: name ?? `Version at rev ${row.revision}`,
      auto: false,
      document: row.document as Prisma.InputJsonValue,
    },
  })
  return id
}

export async function maybeCreateAutoVersion(compositionId: string, revision: number, document: ScriptDocumentV1) {
  if (revision % AUTO_VERSION_EVERY !== 0) return
  const prisma = getPrisma()
  const existing = await prisma.scriptCompositionVersion.findFirst({
    where: { compositionId, revision, auto: true },
  })
  if (existing) return
  await prisma.scriptCompositionVersion.create({
    data: {
      id: createId('scvr'),
      compositionId,
      revision,
      name: `Auto save (rev ${revision})`,
      auto: true,
      document: document as Prisma.InputJsonValue,
    },
  })
}

export async function restoreCompositionVersion(
  workspaceId: string,
  compositionId: string,
  versionId: string,
) {
  const row = await getCompositionForWorkspace(workspaceId, compositionId)
  if (!row) return { ok: false as const, code: 'NOT_FOUND' as const }
  const prisma = getPrisma()
  const version = await prisma.scriptCompositionVersion.findFirst({
    where: { id: versionId, compositionId },
  })
  if (!version) return { ok: false as const, code: 'NOT_FOUND' as const }

  const document = parseScriptCompositionDocument(version.document)
  const opId = createId('scop')
  const revision = row.revision + 1

  await prisma.$transaction(async (tx) => {
    await tx.scriptCompositionOp.create({
      data: {
        id: opId,
        compositionId,
        revision,
        baseRevision: row.revision,
        op: { type: 'restore_version', versionId } as Prisma.InputJsonValue,
      },
    })
    await tx.scriptComposition.update({
      where: { id: compositionId },
      data: {
        document: document as Prisma.InputJsonValue,
        revision,
      },
    })
    await tx.scriptCompositionVersion.create({
      data: {
        id: createId('scvr'),
        compositionId,
        revision,
        name: `Before restore from ${version.name ?? versionId}`,
        auto: false,
        document: row.document as Prisma.InputJsonValue,
      },
    })
  })

  return { ok: true as const, revision, document }
}

export async function getCompositionVersionDocument(
  workspaceId: string,
  compositionId: string,
  versionId: string,
) {
  const row = await getCompositionForWorkspace(workspaceId, compositionId)
  if (!row) return null
  const prisma = getPrisma()
  const version = await prisma.scriptCompositionVersion.findFirst({
    where: { id: versionId, compositionId },
  })
  if (!version) return null
  return parseScriptCompositionDocument(version.document)
}
