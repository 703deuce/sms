import 'server-only'

import { normalizeEdits, type ClipBounds } from '@/lib/clips/edits'
import { clipBoundsForPatch } from '@/lib/server/clips/clip-patch-bounds'
import { getPrisma } from '@/lib/server/db'
import { writeClipEditsOrThrow } from '@/lib/server/clips/write-clip-edits'

/** Prod clip damaged by #929 on-open sentence snap (2026-11-02). */
export const CLIP_5F19E510_ID = 'clip_5f19e510a23241c29190475d4723aa21'

export const CLIP_5F19E510_KNOWN_GOOD = {
  startMs: 0,
  endMs: 32_000,
  trim: { in: 0, out: 32_000 } as const,
  cutRanges: [[29_215, 29_695]] as [number, number][],
}

/** Restore bounds/trim/cuts only; leaves transitions, speeds, splits, etc. untouched. */
export async function restoreClip5f19e510KnownGoodBounds(): Promise<{
  startMs: number
  endMs: number
  trim: { in: number; out: number }
  cutRanges: [number, number][]
  editsSaveVersion: number
}> {
  const prisma = getPrisma()
  const clip = await prisma.clip.findUniqueOrThrow({ where: { id: CLIP_5F19E510_ID } })
  await prisma.clip.update({
    where: { id: CLIP_5F19E510_ID },
    data: { startMs: CLIP_5F19E510_KNOWN_GOOD.startMs, endMs: CLIP_5F19E510_KNOWN_GOOD.endMs },
  })
  const bounds: ClipBounds = {
    clipStartMs: CLIP_5F19E510_KNOWN_GOOD.startMs,
    clipEndMs: CLIP_5F19E510_KNOWN_GOOD.endMs,
    trimMinMs: 0,
    trimMaxMs: 32_000,
  }
  const saved = await writeClipEditsOrThrow(CLIP_5F19E510_ID, bounds, clip.editsSaveVersion, (cur) => ({
    ...cur,
    trim: { ...CLIP_5F19E510_KNOWN_GOOD.trim },
    cutRanges: CLIP_5F19E510_KNOWN_GOOD.cutRanges.map((r) => [...r] as [number, number]),
  }))
  const fresh = await prisma.clip.findUniqueOrThrow({ where: { id: CLIP_5F19E510_ID } })
  const edits = normalizeEdits(fresh.edits, bounds)
  return {
    startMs: fresh.startMs,
    endMs: fresh.endMs,
    trim: edits.trim,
    cutRanges: edits.cutRanges,
    editsSaveVersion: saved.editsSaveVersion,
  }
}

/** Read-only: clips likely mutated by on-open sentence snap since deploy window. */
export async function listClipsLikelySentenceSnapRepaired(sinceIso: string): Promise<
  { id: string; startMs: number; endMs: number; trimIn: number; updatedAt: string }[]
> {
  const since = new Date(sinceIso)
  const prisma = getPrisma()
  const rows = await prisma.clip.findMany({
    where: { deletedAt: null, updatedAt: { gte: since } },
    select: { id: true, startMs: true, endMs: true, edits: true, updatedAt: true },
    orderBy: { updatedAt: 'desc' },
    take: 5000,
  })
  const out: { id: string; startMs: number; endMs: number; trimIn: number; updatedAt: string }[] = []
  for (const row of rows) {
    const bounds = await clipBoundsForPatch(row)
    const edits = normalizeEdits(row.edits, bounds)
    const trimIn = edits.trim.in
    const shifted =
      row.startMs !== 0 ||
      (trimIn > 0 && trimIn !== row.startMs && Math.abs(trimIn - row.startMs) > 40) ||
      (trimIn >= 400 && row.startMs < trimIn - 400)
    if (!shifted) continue
    out.push({
      id: row.id,
      startMs: row.startMs,
      endMs: row.endMs,
      trimIn,
      updatedAt: row.updatedAt.toISOString(),
    })
  }
  return out
}
