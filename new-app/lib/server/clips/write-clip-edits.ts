import 'server-only'

import { normalizeEdits, type ClipBounds, type ClipEditsV2 } from '@/lib/clips/edits'
import { mergeEditsThreeWay } from '@/lib/clips/edits-merge'
import { getPrisma } from '@/lib/server/db'
import { toPrismaJson } from '@/lib/server/clips/prisma-json'

export type WriteClipEditsOk = {
  ok: true
  edits: ClipEditsV2
  editsSaveVersion: number
  updatedAt: string
}

export type WriteClipEditsConflict = {
  ok: false
  conflict: true
  edits: ClipEditsV2
  editsSaveVersion: number
  updatedAt: string
  externalChange: boolean
}

export type WriteClipEditsResult = WriteClipEditsOk | WriteClipEditsConflict

/** Single CAS writer for clips.edits — all server paths must use this. */
export async function writeClipEdits(
  clipId: string,
  bounds: ClipBounds,
  baseVersion: number,
  patchFn: (current: ClipEditsV2) => ClipEditsV2,
  opts?: { clientEdits?: ClipEditsV2; serverBefore?: ClipEditsV2 },
): Promise<WriteClipEditsResult> {
  const prisma = getPrisma()
  const row = await prisma.clip.findUniqueOrThrow({ where: { id: clipId } })
  const serverEdits = normalizeEdits(row.edits, bounds)
  const nextEdits = normalizeEdits(patchFn(serverEdits), bounds)

  const cas = await prisma.clip.updateMany({
    where: { id: clipId, editsSaveVersion: baseVersion },
    data: {
      edits: toPrismaJson(nextEdits),
      editsSaveVersion: { increment: 1 },
    },
  })

  if (cas.count === 1) {
    const fresh = await prisma.clip.findUniqueOrThrow({ where: { id: clipId } })
    return {
      ok: true,
      edits: normalizeEdits(fresh.edits, bounds),
      editsSaveVersion: fresh.editsSaveVersion,
      updatedAt: fresh.updatedAt.toISOString(),
    }
  }

  const fresh = await prisma.clip.findUniqueOrThrow({ where: { id: clipId } })
  const freshEdits = normalizeEdits(fresh.edits, bounds)
  const before = opts?.serverBefore ?? serverEdits
  const client = opts?.clientEdits ?? nextEdits
  const { merged, externalChange } = mergeEditsThreeWay(before, client, freshEdits, bounds)
  return {
    ok: false,
    conflict: true,
    edits: merged,
    editsSaveVersion: fresh.editsSaveVersion,
    updatedAt: fresh.updatedAt.toISOString(),
    externalChange,
  }
}

export async function writeClipEditsOrThrow(
  clipId: string,
  bounds: ClipBounds,
  baseVersion: number,
  patchFn: (current: ClipEditsV2) => ClipEditsV2,
): Promise<WriteClipEditsOk> {
  const res = await writeClipEdits(clipId, bounds, baseVersion, patchFn)
  if (!res.ok) {
    throw new Error('EDITS_CONFLICT')
  }
  return res
}
