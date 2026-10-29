import 'server-only'
import { Prisma } from '@prisma/client'
import { createId } from '@/lib/supabase/id'
import { getPrisma } from '@/lib/server/db'
import type { ClipEditsV2 } from '@/lib/clips/edits'
import { normalizeEdits } from '@/lib/clips/edits'
import { clipBoundsForPatch } from '@/lib/server/clips/clip-patch-bounds'

const MAX_LIST = 30
const MAX_MANUAL = 20
const MAX_AUTO = 10

export function isVersionsTableMissing(err: unknown): boolean {
  if (err && typeof err === 'object' && 'code' in err) {
    const code = (err as { code?: string }).code
    if (code === 'P2021' || code === '42P01') return true
  }
  const msg = err instanceof Error ? err.message : String(err)
  return /clip_edit_versions|42P01|does not exist/i.test(msg)
}

export async function listClipEditVersions(workspaceId: string, clipId: string) {
  const prisma = getPrisma()
  try {
    const rows = await prisma.clipEditVersion.findMany({
      where: { clipId, workspaceId },
      orderBy: { createdAt: 'desc' },
      take: MAX_LIST,
      select: { id: true, name: true, kind: true, createdAt: true },
    })
    return { ok: true as const, items: rows }
  } catch (err) {
    if (isVersionsTableMissing(err)) return { ok: false as const, code: 'VERSIONS_UNAVAILABLE' as const }
    throw err
  }
}

export async function getClipEditVersion(workspaceId: string, clipId: string, versionId: string) {
  const prisma = getPrisma()
  try {
    const row = await prisma.clipEditVersion.findFirst({
      where: { id: versionId, clipId, workspaceId },
    })
    if (!row) return null
    return row
  } catch (err) {
    if (isVersionsTableMissing(err)) return { unavailable: true as const }
    throw err
  }
}

async function pruneVersions(prisma: ReturnType<typeof getPrisma>, clipId: string) {
  const autoRows = await prisma.clipEditVersion.findMany({
    where: { clipId, kind: 'auto' },
    orderBy: { createdAt: 'desc' },
    select: { id: true },
  })
  if (autoRows.length > MAX_AUTO) {
    const drop = autoRows.slice(MAX_AUTO).map((r) => r.id)
    await prisma.clipEditVersion.deleteMany({ where: { id: { in: drop } } })
  }
  const manualCount = await prisma.clipEditVersion.count({ where: { clipId, kind: 'manual' } })
  if (manualCount >= MAX_MANUAL) {
    return { ok: false as const, code: 'LIMIT' as const }
  }
  return { ok: true as const }
}

export async function createClipEditVersion(
  workspaceId: string,
  clip: { id: string; workspaceId: string; editsSaveVersion: number },
  body: { name: string; kind: 'manual' | 'auto'; edits: unknown },
) {
  const prisma = getPrisma()
  const bounds = await clipBoundsForPatch(clip)
  const edits = normalizeEdits(body.edits, bounds)
  try {
    if (body.kind === 'manual') {
      const lim = await pruneVersions(prisma, clip.id)
      if (!lim.ok) return lim
    }
    const id = createId('cevr')
    await prisma.clipEditVersion.create({
      data: {
        id,
        clipId: clip.id,
        workspaceId,
        name: body.name.slice(0, 60),
        kind: body.kind,
        edits: edits as Prisma.InputJsonValue,
        editsSaveVersion: clip.editsSaveVersion,
      },
    })
    if (body.kind === 'auto') await pruneVersions(prisma, clip.id)
    return { ok: true as const, id }
  } catch (err) {
    if (isVersionsTableMissing(err)) return { ok: false as const, code: 'VERSIONS_UNAVAILABLE' as const }
    throw err
  }
}

export async function deleteClipEditVersion(workspaceId: string, clipId: string, versionId: string) {
  const prisma = getPrisma()
  try {
    const row = await prisma.clipEditVersion.findFirst({
      where: { id: versionId, clipId, workspaceId },
    })
    if (!row) return { ok: false as const, code: 'NOT_FOUND' as const }
    if (row.kind === 'original') return { ok: false as const, code: 'ORIGINAL' as const }
    await prisma.clipEditVersion.delete({ where: { id: versionId } })
    return { ok: true as const }
  } catch (err) {
    if (isVersionsTableMissing(err)) return { ok: false as const, code: 'VERSIONS_UNAVAILABLE' as const }
    throw err
  }
}

export async function insertOriginalClipEditSnapshot(
  prisma: ReturnType<typeof getPrisma>,
  clip: { id: string; workspaceId: string; edits: unknown },
): Promise<boolean> {
  const id = createId('cevr')
  try {
    await prisma.$executeRaw`
      INSERT INTO clip_edit_versions (id, "clipId", "workspaceId", name, kind, edits, "editsSaveVersion")
      VALUES (${id}, ${clip.id}, ${clip.workspaceId}, 'Original', 'original', ${JSON.stringify(clip.edits)}::jsonb, 0)
      ON CONFLICT DO NOTHING
    `
    return true
  } catch (err) {
    if (isVersionsTableMissing(err)) {
      console.warn('[clipper:versions] original_snapshot_skip table_missing')
      return false
    }
    console.warn('[clipper:versions] original_snapshot_fail', err instanceof Error ? err.message : String(err))
    return false
  }
}

export type ClipEditVersionEdits = ClipEditsV2
