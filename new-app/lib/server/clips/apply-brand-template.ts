import { applyBrandTemplateToEdits, type BrandTemplatePayload } from '@/lib/clips/apply-brand'
import { brandTemplateSettingsSchema } from '@/lib/clips/brand'
import { normalizeEdits } from '@/lib/clips/edits'
import { getPrisma } from '@/lib/server/db'
import { toPrismaJson } from '@/lib/server/clips/prisma-json'

export async function loadBrandTemplatePayload(workspaceId: string, templateId: string): Promise<BrandTemplatePayload> {
  const prisma = getPrisma()
  const row = await prisma.clipBrandTemplate.findFirst({ where: { id: templateId, workspaceId } })
  if (!row) throw new Error('Template not found')
  return {
    id: row.id,
    logoKey: row.logoKey,
    introVideoKey: row.introVideoKey,
    outroVideoKey: row.outroVideoKey,
    settings: brandTemplateSettingsSchema.parse(row.settings),
  }
}

export async function applyBrandTemplateToClipIds(
  workspaceId: string,
  clipIds: string[],
  templateId: string,
): Promise<{ updated: number }> {
  const payload = await loadBrandTemplatePayload(workspaceId, templateId)
  const prisma = getPrisma()
  const clips = await prisma.clip.findMany({
    where: { workspaceId, id: { in: clipIds }, deletedAt: null },
  })
  let updated = 0
  for (const clip of clips) {
    const bounds = { clipStartMs: clip.startMs, clipEndMs: clip.endMs }
    const edits = normalizeEdits(clip.edits, bounds)
    const next = applyBrandTemplateToEdits(edits, payload)
    await prisma.clip.update({ where: { id: clip.id }, data: { edits: toPrismaJson(next) } })
    updated += 1
  }
  console.info('[clipper:template] applied', { workspaceId, templateId, clipCount: updated })
  return { updated }
}

export async function applyBrandTemplateToProject(
  workspaceId: string,
  projectId: string,
  templateId: string,
): Promise<{ updated: number }> {
  const prisma = getPrisma()
  const project = await prisma.clipProject.findFirst({ where: { id: projectId, workspaceId, deletedAt: null } })
  if (!project) throw new Error('Project not found')
  const clips = await prisma.clip.findMany({
    where: { projectId, workspaceId, deletedAt: null },
    select: { id: true },
  })
  return applyBrandTemplateToClipIds(workspaceId, clips.map((c) => c.id), templateId)
}
