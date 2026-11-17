import 'server-only'
import { randomUUID } from 'node:crypto'
import { getPrisma } from '@/lib/server/db'
import { MotionStudioError } from '@/lib/server/motion-studio/errors'
import { sanitizeBrandProfile, type MsBrandProfile } from '@/lib/motion-studio/creative-options'
type BrandKitRow = { id: string; name: string; profile: MsBrandProfile; createdAt: Date; updatedAt: Date }
export async function listBrandKits(workspaceId: string) {
  const rows = await getPrisma().$queryRaw<BrandKitRow[]>`
    SELECT "id", "name", "profile", "createdAt", "updatedAt"
    FROM "MotionStudioBrandKit" WHERE "workspaceId" = ${workspaceId} ORDER BY "updatedAt" DESC LIMIT 100`
  return rows.map(r => ({ ...r, createdAt: r.createdAt.toISOString(), updatedAt: r.updatedAt.toISOString() }))
}
export async function loadBrandKit(workspaceId: string, id: string) {
  const rows = await getPrisma().$queryRaw<BrandKitRow[]>`
    SELECT "id", "name", "profile", "createdAt", "updatedAt"
    FROM "MotionStudioBrandKit" WHERE "workspaceId" = ${workspaceId} AND "id" = ${id} LIMIT 1`
  if (!rows[0]) throw new MotionStudioError('NOT_FOUND', 'Brand kit not found.', 404)
  return rows[0]
}
export async function saveBrandKit(workspaceId: string, raw: unknown) {
  const o = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw as Record<string, unknown> : {}
  const name = typeof o.name === 'string' ? o.name.trim().slice(0, 100) : ''
  if (!name) throw new MotionStudioError('INVALID', 'Enter a brand name.', 400)
  const profile = sanitizeBrandProfile(o.profile)
  // Upload IDs are validated against this workspace, never blindly trusted.
  if (profile.logoUploadId) {
    const logo = await getPrisma().clipUpload.findFirst({ where: { workspaceId, id: profile.logoUploadId, status: 'COMPLETE' }, select: { mime: true } })
    if (!logo || !['image/png','image/jpeg','image/webp'].includes(logo.mime)) throw new MotionStudioError('INVALID', 'Upload a valid logo image.', 400)
  }
  if (o.id != null && (typeof o.id !== 'string' || !/^msbk_[a-f0-9-]{36}$/.test(o.id)))
    throw new MotionStudioError('INVALID', 'Invalid Brand Kit ID. Select an existing saved kit to update it.', 400)
  const id = typeof o.id === 'string' ? o.id : 'msbk_' + randomUUID()
  if (o.id) {
    const prior = await loadBrandKit(workspaceId, id)
    await getPrisma().$executeRaw`UPDATE "MotionStudioBrandKit" SET "name" = ${name}, "profile" = ${JSON.stringify(profile)}::jsonb, "updatedAt" = CURRENT_TIMESTAMP WHERE "workspaceId" = ${workspaceId} AND "id" = ${prior.id}`
  } else {
    await getPrisma().$executeRaw`INSERT INTO "MotionStudioBrandKit" ("id", "workspaceId", "name", "profile") VALUES (${id}, ${workspaceId}, ${name}, ${JSON.stringify(profile)}::jsonb)`
  }
  const updated = await loadBrandKit(workspaceId, id)
  return { ...updated, createdAt: updated.createdAt.toISOString(), updatedAt: updated.updatedAt.toISOString() }
}
export async function deleteBrandKit(workspaceId: string, id: string) {
  await getPrisma().$executeRaw`DELETE FROM "MotionStudioBrandKit" WHERE "workspaceId" = ${workspaceId} AND "id" = ${id}`
}
