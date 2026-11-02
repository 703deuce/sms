import 'server-only'

import { createId } from '@/lib/supabase/id'
import { hitToSelectPayload, selectKey, type ProjectSelectRow } from '@/lib/clips/editor/project-selects'
import type { SpeechSearchHit } from '@/lib/clips/editor/speech-search'
import { getPrisma } from '@/lib/server/db'

export async function listProjectSelects(workspaceId: string, projectId: string): Promise<ProjectSelectRow[]> {
  const prisma = getPrisma()
  const rows = await prisma.clipProjectSelect.findMany({
    where: { workspaceId, projectId },
    orderBy: { sortOrder: 'asc' },
  })
  return rows.map((r) => ({
    id: r.id,
    sourceId: r.sourceId,
    kind: r.kind,
    label: r.label,
    startMs: r.startMs,
    endMs: r.endMs,
    snippet: r.snippet,
    sortOrder: r.sortOrder,
  }))
}

export async function addProjectSelectFromHit(
  workspaceId: string,
  projectId: string,
  hit: SpeechSearchHit,
): Promise<{ row: ProjectSelectRow; duplicate: boolean }> {
  const prisma = getPrisma()
  const payload = hitToSelectPayload(hit)
  const existing = await prisma.clipProjectSelect.findMany({
    where: { workspaceId, projectId },
    select: { id: true, sourceId: true, startMs: true, endMs: true, sortOrder: true },
  })
  const key = selectKey(payload)
  const dup = existing.find((e) => selectKey(e) === key)
  if (dup) {
    const full = await prisma.clipProjectSelect.findUnique({ where: { id: dup.id } })
    if (!full) throw new Error('Select missing')
    return {
      row: {
        id: full.id,
        sourceId: full.sourceId,
        kind: full.kind,
        label: full.label,
        startMs: full.startMs,
        endMs: full.endMs,
        snippet: full.snippet,
        sortOrder: full.sortOrder,
      },
      duplicate: true,
    }
  }
  const sortOrder = existing.length ? Math.max(...existing.map((e) => e.sortOrder)) + 1 : 0
  const id = createId('sel')
  const row = await prisma.clipProjectSelect.create({
    data: {
      id,
      workspaceId,
      projectId,
      sourceId: payload.sourceId,
      kind: payload.kind,
      label: payload.label,
      startMs: payload.startMs,
      endMs: payload.endMs,
      snippet: payload.snippet,
      sortOrder,
    },
  })
  return {
    row: {
      id: row.id,
      sourceId: row.sourceId,
      kind: row.kind,
      label: row.label,
      startMs: row.startMs,
      endMs: row.endMs,
      snippet: row.snippet,
      sortOrder: row.sortOrder,
    },
    duplicate: false,
  }
}

export async function removeProjectSelect(workspaceId: string, projectId: string, selectId: string): Promise<boolean> {
  const prisma = getPrisma()
  const res = await prisma.clipProjectSelect.deleteMany({ where: { id: selectId, workspaceId, projectId } })
  return res.count > 0
}

export async function clearProjectSelects(workspaceId: string, projectId: string): Promise<void> {
  const prisma = getPrisma()
  await prisma.clipProjectSelect.deleteMany({ where: { workspaceId, projectId } })
}
