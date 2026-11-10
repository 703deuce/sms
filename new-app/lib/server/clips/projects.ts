import type { ClipProjectStatus, Prisma } from '@prisma/client'
import { createId } from '@/lib/supabase/id'
import { isT2vFeatureEnabled } from '@/lib/server/clips/feature-gates'
import { getPrisma } from '@/lib/server/db'
import { withAutoContentDetection } from '@/lib/clips/content-detection'
import { clipProjectSettingsSchema, defaultClipSettings, type ClipProjectSettings } from '@/lib/clips/settings'
import { assertByoUploadDuration } from '@/lib/clips/byo-project'
import { assertFullVideoUploadDuration, sourceAspectRatio } from '@/lib/clips/full-video'
import { buildProcessProjectJobPayload } from '@/lib/server/clips/process-project-payload'
import { projectWordsKey, storageDriverName, uploadSourceKey } from '@/lib/storage'
import type { ClipBrandTemplate } from '@prisma/client'

/** List/dashboard query — excludes heavy `transcriptWords` JSON (was ~32kB/project in HTML). */
export const clipProjectListSelect = {
  id: true,
  workspaceId: true,
  title: true,
  uploadId: true,
  sourceUrl: true,
  rangeStartMs: true,
  rangeEndMs: true,
  status: true,
  stage: true,
  progress: true,
  error: true,
  transcriptKey: true,
  thumbKey: true,
  createdAt: true,
  updatedAt: true,
  createdById: true,
  folderId: true,
  deletedAt: true,
  sourceKind: true,
  lastViewedAt: true,
} as const satisfies Prisma.ClipProjectSelect

export type ClipProjectListRow = Prisma.ClipProjectGetPayload<{ select: typeof clipProjectListSelect }>

export const clipProjectApiListSelect = {
  ...clipProjectListSelect,
  settings: true,
  transcriptWords: true,
} as const satisfies Prisma.ClipProjectSelect

export type ClipProjectApiListRow = Prisma.ClipProjectGetPayload<{ select: typeof clipProjectApiListSelect }>

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
    /** Dev API GET /api/clips/projects — includes settings + transcriptWords for serializeProject. */
    includeSettingsAndWords?: boolean
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
    select: opts.includeSettingsAndWords ? clipProjectApiListSelect : clipProjectListSelect,
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
  const baseSettings = withAutoContentDetection(
    clipProjectSettingsSchema.parse(input.settings ?? defaultClipSettings()),
  )
  let settings = brandRow
    ? withAutoContentDetection(mergeDefaultBrandSettings(baseSettings, brandRow))
    : baseSettings
  if (settings.fullVideo) {
    // FV1: whole source, 3 h cap; canvas follows the source unless the client picked one.
    assertFullVideoUploadDuration(upload.durationMs)
    const rawAspect = (input.settings as { aspectRatio?: unknown } | null | undefined)?.aspectRatio
    settings = {
      ...settings,
      byo: true,
      fullVideo: true,
      rangeStartMs: 0,
      rangeEndMs: upload.durationMs || 0,
      aspectRatio: typeof rawAspect === 'string' ? settings.aspectRatio : sourceAspectRatio(upload.width, upload.height),
    }
  } else if (settings.byo) {
    assertByoUploadDuration(upload.durationMs)
    settings = {
      ...settings,
      rangeStartMs: 0,
      rangeEndMs: upload.durationMs || 0,
    }
  }
  if (settings.autoAgentClipMode && !settings.byo && !settings.fullVideo) {
    const { aiProducerAgentServerEnabled } = await import('@/lib/ai-producer-agent/flags')
    if (!aiProducerAgentServerEnabled()) throw new Error('ai_producer_agent_disabled')
  }
  const rangeEnd = settings.byo
    ? settings.rangeEndMs
    : settings.rangeEndMs || upload.durationMs || 0
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

/** G1b3: canvas lengths a blank project may ask for (worker clamps the same: blank_project.py). */
export const BLANK_MIN_MS = 10_000
export const BLANK_MAX_MS = 60 * 60 * 1000
/** PR-01: default blank canvas = 10 s (matches initial trim); worker renders this quickly. */
export const BLANK_DEFAULT_MS = 10_000
export const BLANK_INITIAL_TRIM_MS = 10_000

/**
 * G1b3: blank project (no source video). A PENDING upload row the worker fills with a black, silent
 * canvas, a full-video project (settings.blank) and its PROCESS_PROJECT job (payload.blank → no
 * transcription, no credits). Additive: existing columns / job type only.
 */
export async function createBlankClipProject(
  workspaceId: string,
  input: { blank: { aspectRatio?: string; durationMs?: number }; title?: string },
) {
  const prisma = getPrisma()
  const uploadId = createId('upl')
  await prisma.clipUpload.create({
    data: {
      id: uploadId,
      workspaceId,
      key: uploadSourceKey(workspaceId, uploadId, 'mp4'),
      filename: 'Blank canvas.mp4',
      bytes: BigInt(0),
      mime: 'video/mp4',
      status: 'PENDING',
      storageDriver: storageDriverName(),
    },
  })
  const parsed = clipProjectSettingsSchema.parse({
    ...defaultClipSettings(),
    ...(input.blank.aspectRatio ? { aspectRatio: input.blank.aspectRatio } : {}),
  })
  const durationMs = Math.max(BLANK_MIN_MS, Math.min(BLANK_MAX_MS, Math.round(input.blank.durationMs ?? BLANK_DEFAULT_MS)))
  const settings: ClipProjectSettings = { ...parsed, byo: true, fullVideo: true, blank: true, rangeStartMs: 0, rangeEndMs: durationMs }
  const projectId = createId('proj')
  const project = await prisma.clipProject.create({
    data: {
      id: projectId,
      workspaceId,
      title: input.title?.trim() || 'Blank project',
      uploadId,
      settings: JSON.parse(JSON.stringify(settings)),
      rangeStartMs: 0,
      rangeEndMs: durationMs,
      status: 'QUEUED',
      stage: 'queued',
      progress: 0,
      transcriptKey: projectWordsKey(workspaceId, projectId),
    },
  })
  await prisma.clipJob.create({
    data: {
      id: createId('job'),
      projectId: project.id,
      type: 'PROCESS_PROJECT',
      status: 'QUEUED',
      payload: buildProcessProjectJobPayload(settings, { blankMs: durationMs }),
    },
  })
  return project
}

/** PR-01: project header duration — blank projects use the clip trim span, not rangeEndMs (often 10 min legacy). */
export function blankProjectDisplayDurationMs(
  project: { rangeStartMs: number; rangeEndMs: number },
  uploadDurationMs: number | null | undefined,
  clipEdits: unknown,
): number {
  const trim = (clipEdits as { trim?: { in?: number; out?: number } } | null)?.trim
  if (trim && typeof trim.out === 'number' && typeof trim.in === 'number') {
    return Math.max(0, trim.out - trim.in)
  }
  if (uploadDurationMs && uploadDurationMs > 0) return uploadDurationMs
  return Math.max(0, Math.min(BLANK_INITIAL_TRIM_MS, project.rangeEndMs - project.rangeStartMs))
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
  const baseSettings = withAutoContentDetection(
    clipProjectSettingsSchema.parse(input.settings ?? defaultClipSettings()),
  )
  const settings = brandRow
    ? withAutoContentDetection(mergeDefaultBrandSettings(baseSettings, brandRow))
    : baseSettings

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

export function parseSettings(raw: unknown, projectId?: string): ClipProjectSettings {
  const received = raw && typeof raw === 'object' && !Array.isArray(raw)
    ? raw as Record<string, unknown> : {}
  if (received.v == null) {
    console.info('[clipper:settings]', {
      action: 'legacy_missing_v', projectId: projectId ?? 'unknown',
      settingsVersion: defaultClipSettings().v,
    })
  }
  const parsed = clipProjectSettingsSchema.parse({
    ...defaultClipSettings(),
    ...received,
    // Only missing versions are repaired: a known incompatible version is
    // still rejected rather than silently interpreted as the current schema.
    v: received.v ?? defaultClipSettings().v,
  })
  console.info('[clipper:settings]', {
    action: 'validated', projectId: projectId ?? 'unknown', settingsVersion: parsed.v,
  })
  return withAutoContentDetection(parsed)
}

export async function createClipProjectFromPrompt(
  workspaceId: string,
  input: { prompt: string; title?: string; settings?: unknown },
) {
  const prompt = input.prompt.trim()
  if (!prompt) throw new Error('Describe what you want to make')

  const prisma = getPrisma()
  const baseSettings = withAutoContentDetection(
    clipProjectSettingsSchema.parse({
      ...(input.settings ?? defaultClipSettings()),
      prompt,
    }),
  )
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
