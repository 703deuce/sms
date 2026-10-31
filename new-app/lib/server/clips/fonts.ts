import 'server-only'
import { createId } from '@/lib/supabase/id'
import { getPrisma } from '@/lib/server/db'
import { getClipStorage, getClipStorageForObjectKey } from '@/lib/storage'
import { FONT_MAX_BYTES, FontParseError, parseFont, type FontMetricsRow } from '@/lib/clips/font-parse'
import { FONTS_MAX_PER_WORKSPACE, isReservedFamily, type WorkspaceFont } from '@/lib/clips/fonts-shared'
import { safeFamily } from '@/lib/clips/render-plan/text-rich'

/** G3b: workspace fonts — upload (parse + store on clip storage), list, soft delete, read bytes. */
export class FontUploadError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message)
  }
}

type Row = { id: string; family: string; filename: string; bytes: number; metrics: unknown; storageKey: string; storageDriver: string | null }
const toFont = (r: Row): WorkspaceFont => ({ id: r.id, family: r.family, filename: r.filename, bytes: r.bytes, metrics: r.metrics as FontMetricsRow })

export async function listFonts(workspaceId: string): Promise<WorkspaceFont[]> {
  const rows = (await getPrisma().clipFont.findMany({ where: { workspaceId, deletedAt: null }, orderBy: { createdAt: 'asc' } })) as Row[]
  return rows.map(toFont)
}

export async function uploadFont(workspaceId: string, filename: string, bytes: Uint8Array): Promise<{ font: WorkspaceFont; existing: boolean }> {
  if (bytes.byteLength > FONT_MAX_BYTES) throw new FontUploadError('Font file is over 8 MB', 413)
  let parsed
  try {
    parsed = parseFont(bytes)
  } catch (e) {
    throw new FontUploadError(e instanceof FontParseError ? e.message : 'Could not read the font file')
  }
  const family = safeFamily(parsed.family)
  if (!family) throw new FontUploadError('The font has no usable family name')
  if (isReservedFamily(family)) throw new FontUploadError(`“${family}” is already a built-in font`)
  const prisma = getPrisma()
  const live = (await prisma.clipFont.findMany({ where: { workspaceId, deletedAt: null } })) as Row[]
  const same = live.find((r) => r.family.toLowerCase() === family.toLowerCase())
  if (same) return { font: toFont(same), existing: true }
  if (live.length >= FONTS_MAX_PER_WORKSPACE) throw new FontUploadError(`Up to ${FONTS_MAX_PER_WORKSPACE} fonts per workspace — delete one first`)
  const id = createId('font')
  const storage = getClipStorage()
  const storageKey = `fonts/${workspaceId}/${id}.${parsed.format}`
  await storage.putBytes(storageKey, Buffer.from(bytes), parsed.format === 'otf' ? 'font/otf' : 'font/ttf')
  const row = (await prisma.clipFont.create({
    data: {
      id,
      workspaceId,
      family,
      filename: filename.slice(0, 200) || `${family}.${parsed.format}`,
      storageKey,
      storageDriver: storage.name,
      bytes: bytes.byteLength,
      metrics: parsed.metrics,
    },
  })) as Row
  return { font: toFont(row), existing: false }
}

export async function deleteFont(workspaceId: string, id: string): Promise<boolean> {
  const r = await getPrisma().clipFont.updateMany({ where: { id, workspaceId, deletedAt: null }, data: { deletedAt: new Date() } })
  return r.count > 0
}

/** Font bytes for the preview (soft-deleted rows still serve: old projects keep rendering). */
export async function fontFile(workspaceId: string, id: string): Promise<{ body: ArrayBuffer; type: string } | null> {
  const row = (await getPrisma().clipFont.findFirst({ where: { id, workspaceId } })) as Row | null
  if (!row) return null
  const storage = await getClipStorageForObjectKey(row.storageKey, row.storageDriver)
  const url = await storage.createSignedDownloadUrl(row.storageKey, 300)
  const res = await fetch(url)
  if (!res.ok) return null
  return { body: await res.arrayBuffer(), type: row.storageKey.endsWith('.otf') ? 'font/otf' : 'font/ttf' }
}
