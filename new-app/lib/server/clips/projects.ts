import type { ClipProjectStatus } from '@prisma/client'
import { createId } from '@/lib/supabase/id'
import { isT2vFeatureEnabled } from '@/lib/server/clips/feature-gates'
import { getPrisma } from '@/lib/server/db'
import { clipProjectSettingsSchema, defaultClipSettings, type ClipProjectSettings } from '@/lib/clips/settings'
import { buildProcessProjectJobPayload } from '@/lib/server/clips/process-project-payload'
import { projectWordsKey } from '@/lib/storage'
import type { ClipBrandTemplate } from '@prisma/client'

function mergeDefaultBrandSettings(
  baseSettings: ClipProjectSettings,
  brandRow: ClipBrandTemplate,
): ClipProjectSettings {
  return clipProjectSettingsSchema.parse({
    ...baseSettings,
    brandTemplateId: brandRow.id,
    brand: {
      templateId: brandRow.id,
      logoKey: brandRow.logoKey,
      introVideoKey: brandRow.introVideoKey,
      outroVideoKey: brandRow.outroVideoKey,
      useIntro: Boolean(brandRow.introVideoKey),
      useOutro: Boolean(brandRow.outroVideoKey),
      ...(typeof brandRow.settings === 'object' && brandRow.settings !== null
        ? (brandRow.settings as Record<string, unknown>)
        : {}),
    },
  })
}

export async function listClipProjects(
  workspaceId: string,
  opts: {
    q?: string
    status?: string
    kind?: string
    limit?: number
    trash?: boolean
    folderId?: string | null
  },
) {
  const prisma = getPrisma()
  const where: Record<string, unknown> = {
    workspaceId,
    deletedAt: opts.trash ? { not: null } : null,
  }
  const t2vOn = isT2vFeatureEnabled()
  if (!t2vOn) {
    if (opts.kind === 'video') {
      return []
    }
    where.sourceKind = { not: 't2v' }
  } else if (opts.kind === 'video') where.sourceKind = 't2v'
  else if (opts.kind === 'clips') where.sourceKind = { not: 't2v' }
  if (opts.folderId !== undefined) {
    where.folderId = opts.folderId
  }
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
  const settings = brandRow ? mergeDefaultBrandSettings(baseSettings, brandRow) : baseSettings
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
      payload: buildProcessProjectJobPayload(settings),
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
  const settings = brandRow ? mergeDefaultBrandSettings(baseSettings, brandRow) : baseSettings

  const projectId = createId('proj')
  const defaultTitles: Record<string, string> = {
    drive: 'Google Drive import',
    dropbox: 'Dropbox import',
    youtube: 'YouTube import',
    twitch: 'Twitch import',
  }
  const title = input.title?.trim() || defaultTitles[check.kind] || 'Link import'
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

export async function createClipProjectFromPrompt(
  workspaceId: string,
  input: { prompt: string; title?: string; settings?: unknown },
) {
  const prompt = input.prompt.trim()
  if (!prompt) throw new Error('Describe what you want to make')

  const prisma = getPrisma()
  const baseSettings = clipProjectSettingsSchema.parse({
    ...(input.settings ?? defaultClipSettings()),
    prompt,
  })
  const projectId = createId('proj')
  const title = input.title?.trim() || prompt.slice(0, 80) || 'Untitled project'

  return prisma.clipProject.create({
    data: {
      id: projectId,
      workspaceId,
      title,
      settings: JSON.parse(JSON.stringify(baseSettings)),
      rangeStartMs: 0,
      rangeEndMs: 0,
      status: 'DRAFT',
      stage: 'draft',
      progress: 0,
      transcriptKey: projectWordsKey(workspaceId, projectId),
    },
  })
}

export async function attachUploadToClipProject(
  workspaceId: string,
  projectId: string,
  uploadId: string,
) {
  const prisma = getPrisma()
  const project = await prisma.clipProject.findFirst({
    where: { id: projectId, workspaceId, deletedAt: null },
  })
  if (!project) throw new Error('Project not found')

  const upload = await prisma.clipUpload.findFirst({
    where: { id: uploadId, workspaceId, status: 'COMPLETE' },
  })
  if (!upload) throw new Error('Upload not complete')

  const settings = parseSettings(project.settings)
  const rangeEnd = settings.rangeEndMs || upload.durationMs || 0
  const nextSettings = { ...settings, rangeEndMs: rangeEnd }

  await prisma.clipProject.update({
    where: { id: projectId },
    data: {
      uploadId: upload.id,
      settings: JSON.parse(JSON.stringify(nextSettings)),
      rangeEndMs: rangeEnd,
      status: 'QUEUED',
      stage: 'queued',
      progress: 0,
    },
  })

  const jobId = createId('job')
  await prisma.clipJob.create({
    data: {
      id: jobId,
      projectId,
      type: 'PROCESS_PROJECT',
      status: 'QUEUED',
      payload: buildProcessProjectJobPayload(nextSettings),
    },
  })

  return prisma.clipProject.findUnique({ where: { id: projectId } })
}

export async function attachImportUrlToClipProject(
  workspaceId: string,
  projectId: string,
  sourceUrl: string,
) {
  const { validateImportUrlForSubmit } = await import('@/lib/clips/import-url')
  const check = validateImportUrlForSubmit(sourceUrl)
  if (!check.ok) throw new Error(check.message)

  const prisma = getPrisma()
  const project = await prisma.clipProject.findFirst({
    where: { id: projectId, workspaceId, deletedAt: null },
  })
  if (!project) throw new Error('Project not found')

  const normalizedUrl = sourceUrl.trim()
  await prisma.clipProject.update({
    where: { id: projectId },
    data: {
      sourceUrl: normalizedUrl,
      status: 'QUEUED',
      stage: 'importing',
      progress: 0,
    },
  })

  const jobId = createId('job')
  await prisma.clipJob.create({
    data: {
      id: jobId,
      projectId,
      type: 'IMPORT_URL',
      status: 'QUEUED',
      payload: { sourceUrl: normalizedUrl, kind: check.kind },
    },
  })

  return prisma.clipProject.findUnique({ where: { id: projectId } })
}
