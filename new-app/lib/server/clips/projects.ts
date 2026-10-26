import type { ClipProjectStatus } from '@prisma/client'
import { createId } from '@/lib/supabase/id'
import { getPrisma } from '@/lib/server/db'
import { clipProjectSettingsSchema, defaultClipSettings, type ClipProjectSettings } from '@/lib/clips/settings'
import { projectWordsKey } from '@/lib/storage'

export async function listClipProjects(workspaceId: string, opts: { q?: string; status?: string; limit?: number }) {
  const prisma = getPrisma()
  const where: Record<string, unknown> = { workspaceId, deletedAt: null }
  if (opts.q?.trim()) where.title = { contains: opts.q.trim(), mode: 'insensitive' }
  if (opts.status && opts.status !== 'all') {
    if (opts.status === 'processing') {
      where.status = { notIn: ['READY', 'FAILED', 'CANCELED', 'DRAFT'] as ClipProjectStatus[] }
    } else if (opts.status === 'ready') where.status = 'READY'
    else if (opts.status === 'failed') where.status = 'FAILED'
  }
  return prisma.clipProject.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: opts.limit ?? 50,
  })
}

export async function createClipProject(
  workspaceId: string,
  input: { uploadId: string; title?: string; settings?: unknown },
) {
  const prisma = getPrisma()
  const upload = await prisma.clipUpload.findFirst({
    where: { id: input.uploadId, workspaceId, status: 'COMPLETE' },
  })
  if (!upload) throw new Error('Upload not complete')
  const brandRow = await prisma.clipBrandTemplate.findFirst({
    where: { workspaceId, isDefault: true },
  })
  const baseSettings = clipProjectSettingsSchema.parse(input.settings ?? defaultClipSettings())
  const settings = brandRow
    ? clipProjectSettingsSchema.parse({
        ...baseSettings,
        brand: {
          templateId: brandRow.id,
          logoKey: brandRow.logoKey,
          ...(typeof brandRow.settings === 'object' ? brandRow.settings : {}),
        },
      })
    : baseSettings
  const rangeEnd = settings.rangeEndMs || upload.durationMs || 0
  const projectId = createId('proj')
  const title = input.title?.trim() || upload.filename.replace(/\.[^.]+$/, '')
  const project = await prisma.clipProject.create({
    data: {
      id: projectId,
      workspaceId,
      title,
      uploadId: upload.id,
      settings: JSON.parse(JSON.stringify(settings)),
      rangeStartMs: settings.rangeStartMs,
      rangeEndMs: rangeEnd,
      status: 'QUEUED',
      stage: 'queued',
      progress: 0,
      transcriptKey: projectWordsKey(workspaceId, projectId),
    },
  })
  const jobId = createId('job')
  await prisma.clipJob.create({
    data: {
      id: jobId,
      projectId: project.id,
      type: 'PROCESS_PROJECT',
      status: 'QUEUED',
      payload: {},
    },
  })
  return project
}

export async function createClipProjectFromImportUrl(
  workspaceId: string,
  input: { sourceUrl: string; title?: string; settings?: unknown },
) {
  const { validateImportUrlForSubmit } = await import('@/lib/clips/import-url')
  const check = validateImportUrlForSubmit(input.sourceUrl)
  if (!check.ok) throw new Error(check.message)

  const prisma = getPrisma()
  const brandRow = await prisma.clipBrandTemplate.findFirst({
    where: { workspaceId, isDefault: true },
  })
  const baseSettings = clipProjectSettingsSchema.parse(input.settings ?? defaultClipSettings())
  const settings = brandRow
    ? clipProjectSettingsSchema.parse({
        ...baseSettings,
        brand: {
          templateId: brandRow.id,
          logoKey: brandRow.logoKey,
          ...(typeof brandRow.settings === 'object' ? brandRow.settings : {}),
        },
      })
    : baseSettings

  const projectId = createId('proj')
  const title =
    input.title?.trim() ||
    (check.kind === 'drive' ? 'Google Drive import' : 'Dropbox import')
  const normalizedUrl = input.sourceUrl.trim()

  const project = await prisma.clipProject.create({
    data: {
      id: projectId,
      workspaceId,
      title,
      sourceUrl: normalizedUrl,
      settings: JSON.parse(JSON.stringify(settings)),
      rangeStartMs: settings.rangeStartMs,
      rangeEndMs: settings.rangeEndMs || 0,
      status: 'QUEUED',
      stage: 'importing',
      progress: 0,
      transcriptKey: projectWordsKey(workspaceId, projectId),
    },
  })
  const jobId = createId('job')
  await prisma.clipJob.create({
    data: {
      id: jobId,
      projectId: project.id,
      type: 'IMPORT_URL',
      status: 'QUEUED',
      payload: { sourceUrl: normalizedUrl, kind: check.kind },
    },
  })
  return project
}

export function parseSettings(raw: unknown): ClipProjectSettings {
  return clipProjectSettingsSchema.parse(raw)
}
