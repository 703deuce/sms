import 'server-only'
import { createId } from '@/lib/supabase/id'
import { getPrisma } from '@/lib/server/db'
import { getClipStorage, getClipStorageForObjectKey } from '@/lib/storage'
import { CubeParseError, parseCube } from '@/lib/clips/editor/color-grade'
import { LUT_MAX_BYTES, LUTS_MAX_PER_WORKSPACE, lutName, type WorkspaceLut } from '@/lib/clips/luts-shared'

/** G4a workspace LUTs — upload (validate + store on clip storage), list, soft delete, read bytes. */
export class LutUploadError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message)
  }
}

type Row = { id: string; name: string; filename: string; size: number; bytes: number; storageKey: string; storageDriver: string | null }
const toLut = (r: Row): WorkspaceLut => ({ id: r.id, name: r.name, filename: r.filename, size: r.size, bytes: r.bytes })

export async function listLuts(workspaceId: string): Promise<WorkspaceLut[]> {
  const rows = (await getPrisma().clipLut.findMany({ where: { workspaceId, deletedAt: null }, orderBy: { createdAt: 'asc' } })) as Row[]
  return rows.map(toLut)
}

/** Validates with the shared parser (TS == color_grade.parse_cube) before anything is stored. */
export function validateCube(bytes: Uint8Array): { text: string; size: number } {
  if (bytes.byteLength > LUT_MAX_BYTES) throw new LutUploadError('LUT file is over 12 MB', 413)
  let text: string
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    throw new LutUploadError('The .cube file is not text')
  }
  try {
    return { text, size: parseCube(text).size }
  } catch (e) {
    throw new LutUploadError(e instanceof CubeParseError ? e.message : 'Could not read the .cube file')
  }
}

export async function uploadLut(workspaceId: string, filename: string, bytes: Uint8Array): Promise<WorkspaceLut> {
  const { text, size } = validateCube(bytes)
  const prisma = getPrisma()
  const live = await prisma.clipLut.count({ where: { workspaceId, deletedAt: null } })
  if (live >= LUTS_MAX_PER_WORKSPACE) throw new LutUploadError(`Up to ${LUTS_MAX_PER_WORKSPACE} LUTs per workspace — delete one first`)
  const id = createId('lut')
  const storage = getClipStorage()
  const storageKey = `luts/${workspaceId}/${id}.cube`
  await storage.putBytes(storageKey, Buffer.from(bytes), 'text/plain')
  const row = (await prisma.clipLut.create({
    data: {
      id,
      workspaceId,
      name: lutName(text, filename),
      filename: filename.slice(0, 200) || 'lut.cube',
      size,
      storageKey,
      storageDriver: storage.name,
      bytes: bytes.byteLength,
    },
  })) as Row
  return toLut(row)
}

export async function deleteLut(workspaceId: string, id: string): Promise<boolean> {
  const r = await getPrisma().clipLut.updateMany({ where: { id, workspaceId, deletedAt: null }, data: { deletedAt: new Date() } })
  return r.count > 0
}

/** .cube text for the preview / scopes (soft-deleted rows still serve: old projects keep rendering). */
export async function lutFile(workspaceId: string, id: string): Promise<string | null> {
  const row = (await getPrisma().clipLut.findFirst({ where: { id, workspaceId } })) as Row | null
  if (!row) return null
  const storage = await getClipStorageForObjectKey(row.storageKey, row.storageDriver)
  const url = await storage.createSignedDownloadUrl(row.storageKey, 300)
  const res = await fetch(url)
  if (!res.ok) return null
  return res.text()
}
