import { Prisma } from '@prisma/client'
import {
  applyCompositionOp,
  emptyDocument,
  type ScriptCompositionOp,
} from '@/lib/clips/script-edl/ops'
import type { ScriptDocumentV1 } from '@/lib/clips/script-edl/types'
import { getPrisma } from '@/lib/server/db'
import { createId } from '@/lib/supabase/id'
import { maybeCreateAutoVersion } from '@/lib/server/clips/composition-versions'

const SNAPSHOT_EVERY = 200

/** Round-trip parse for DB JSON — must preserve all M4+ document fields. */
export function parseScriptCompositionDocument(raw: unknown): ScriptDocumentV1 {
  if (!raw || typeof raw !== 'object') return { v: 1, keptWordIds: [], deletedWordIds: [] }
  const d = raw as ScriptDocumentV1
  if (d.v !== 1) return { v: 1, keptWordIds: [], deletedWordIds: [] }
  return {
    v: 1,
    keptWordIds: Array.isArray(d.keptWordIds) ? d.keptWordIds.map(String) : [],
    deletedWordIds: Array.isArray(d.deletedWordIds) ? d.deletedWordIds.map(String) : [],
    wordOrder: Array.isArray(d.wordOrder) ? d.wordOrder.map(String) : undefined,
    gapInserts: d.gapInserts,
    splitAtOutMs: Array.isArray(d.splitAtOutMs) ? d.splitAtOutMs.map((n) => Number(n)) : undefined,
    padBeforeMs: d.padBeforeMs && typeof d.padBeforeMs === 'object' ? (d.padBeforeMs as Record<string, number>) : undefined,
    scenes: Array.isArray(d.scenes) ? d.scenes : undefined,
    markers: Array.isArray(d.markers) ? d.markers : undefined,
    overlays: Array.isArray(d.overlays) ? d.overlays : undefined,
    musicTracks: Array.isArray(d.musicTracks) ? d.musicTracks : undefined,
    broll: Array.isArray(d.broll) ? d.broll : undefined,
    audio: d.audio && typeof d.audio === 'object' ? d.audio : undefined,
    settings: d.settings && typeof d.settings === 'object' ? d.settings : undefined,
    ignoredWordIds: Array.isArray(d.ignoredWordIds) ? d.ignoredWordIds.map(String) : undefined,
    transcriptHiddenWordIds: Array.isArray(d.transcriptHiddenWordIds)
      ? d.transcriptHiddenWordIds.map(String)
      : undefined,
    wordSourceAdjust:
      d.wordSourceAdjust && typeof d.wordSourceAdjust === 'object'
        ? (d.wordSourceAdjust as ScriptDocumentV1['wordSourceAdjust'])
        : undefined,
    reframeKeyframes: Array.isArray(d.reframeKeyframes) ? d.reframeKeyframes : undefined,
  }
}

export async function ensureFullComposition(
  workspaceId: string,
  projectId: string,
  projectTitle: string,
  allWordIds: string[],
) {
  const prisma = getPrisma()
  const existing = await prisma.scriptComposition.findFirst({
    where: { projectId, kind: 'FULL', clipId: null, deletedAt: null },
  })
  if (existing) {
    const doc = parseScriptCompositionDocument(existing.document)
    if (!doc.keptWordIds.length && allWordIds.length) {
      const seeded = emptyDocument(allWordIds)
      return prisma.scriptComposition.update({
        where: { id: existing.id },
        data: { document: seeded as Prisma.InputJsonValue },
      })
    }
    return existing
  }

  const doc = emptyDocument(allWordIds)
  return prisma.scriptComposition.create({
    data: {
      id: createId('scmp'),
      projectId,
      workspaceId,
      kind: 'FULL',
      title: projectTitle || 'Full video',
      document: doc as Prisma.InputJsonValue,
      revision: 0,
    },
  })
}

export async function getCompositionForWorkspace(workspaceId: string, compositionId: string) {
  const prisma = getPrisma()
  return prisma.scriptComposition.findFirst({
    where: { id: compositionId, workspaceId, deletedAt: null },
  })
}

export type OpBatchInput = {
  baseRevision: number
  ops: { id: string; op: ScriptCompositionOp }[]
}

export async function applyCompositionOpBatch(
  workspaceId: string,
  compositionId: string,
  input: OpBatchInput,
): Promise<
  | { ok: true; revision: number; document: ScriptDocumentV1; ackedOpIds: string[] }
  | { ok: false; code: 'NOT_FOUND' | 'STALE_REVISION' | 'INVALID'; revision?: number }
> {
  const prisma = getPrisma()
  const row = await getCompositionForWorkspace(workspaceId, compositionId)
  if (!row) return { ok: false, code: 'NOT_FOUND' }

  if (input.baseRevision !== row.revision) {
    return { ok: false, code: 'STALE_REVISION', revision: row.revision }
  }

  let document = parseScriptCompositionDocument(row.document)
  let revision = row.revision
  const acked: string[] = []

  for (const item of input.ops) {
    const existing = await prisma.scriptCompositionOp.findUnique({
      where: { compositionId_id: { compositionId, id: item.id } },
    })
    if (existing) {
      acked.push(item.id)
      revision = existing.revision
      document = parseScriptCompositionDocument(
        (await prisma.scriptComposition.findUniqueOrThrow({ where: { id: compositionId } })).document,
      )
      continue
    }

    document = applyCompositionOp(document, item.op)
    revision += 1
    await prisma.$transaction(async (tx) => {
      await tx.scriptCompositionOp.create({
        data: {
          id: item.id,
          compositionId,
          revision,
          baseRevision: revision - 1,
          op: item.op as Prisma.InputJsonValue,
        },
      })
      await tx.scriptComposition.update({
        where: { id: compositionId },
        data: {
          document: document as Prisma.InputJsonValue,
          revision,
        },
      })
      if (revision % SNAPSHOT_EVERY === 0) {
        await tx.scriptCompositionSnapshot.create({
          data: {
            id: createId('scsn'),
            compositionId,
            revision,
            document: document as Prisma.InputJsonValue,
          },
        })
      }
    })
    await maybeCreateAutoVersion(compositionId, revision, document)
    acked.push(item.id)
  }

  const { syncClipBoundsFromComposition } = await import('@/lib/server/clips/clip-script-composition')
  await syncClipBoundsFromComposition(compositionId, document)

  return { ok: true, revision, document, ackedOpIds: acked }
}

export type CompositionOpRow = {
  id: string
  revision: number
  baseRevision: number
  op: ScriptCompositionOp
  createdAt: string
}

/** Ops with revision > sinceRevision (exclusive of snapshot revision before first op). */
export async function listCompositionOpsSince(
  workspaceId: string,
  compositionId: string,
  sinceRevision: number,
): Promise<{ revision: number; document: ScriptDocumentV1; ops: CompositionOpRow[] } | null> {
  const row = await getCompositionForWorkspace(workspaceId, compositionId)
  if (!row) return null
  const prisma = getPrisma()
  const ops = await prisma.scriptCompositionOp.findMany({
    where: { compositionId, revision: { gt: sinceRevision } },
    orderBy: { revision: 'asc' },
    take: 500,
  })
  return {
    revision: row.revision,
    document: parseScriptCompositionDocument(row.document),
    ops: ops.map((o) => ({
      id: o.id,
      revision: o.revision,
      baseRevision: o.baseRevision,
      op: o.op as ScriptCompositionOp,
      createdAt: o.createdAt.toISOString(),
    })),
  }
}
