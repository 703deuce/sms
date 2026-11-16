import 'server-only'
import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto'
import { getPrisma } from '@/lib/server/db'
import { createReadableSignedUrl, getClipStorage, storageDriverName } from '@/lib/storage'
import { toPrismaJson } from '@/lib/server/clips/prisma-json'
import { MotionStudioError } from '@/lib/server/motion-studio/errors'

const db = () => getPrisma()
const toObject = (x: unknown): Record<string, unknown> => x && typeof x === 'object' && !Array.isArray(x) ? x as Record<string, unknown> : {}
const str = (x: unknown, max = 4000): string => typeof x === 'string' ? x.trim().slice(0, max) : ''
const sha = (x: string): Buffer => createHash('sha256').update(x).digest()
const MAX_FILE = 2_000_000_000
type Artifact = { id: string; key: string; kind: string; filename: string; mime: string; bytes: number; state: 'pending' | 'ready'; s3UploadId?: string }
const artifacts = (raw: unknown): Artifact[] => Array.isArray(raw) ? raw as Artifact[] : []
const isDone = (status: string) => ['complete', 'failed', 'dispatch_failed'].includes(status)

function baseUrl(request: Request): string {
  const value = process.env.MOTION_STUDIO_AGENT_PUBLIC_URL || new URL(request.url).origin
  const url = new URL(value)
  const productionHost = url.hostname === 'transovo.ai' || url.hostname.endsWith('.transovo.ai')
  const localHost = process.env.NODE_ENV !== 'production' && ['localhost', '127.0.0.1'].includes(url.hostname)
  if ((!productionHost && !localHost) || (url.protocol !== 'https:' && !localHost)) {
    throw new MotionStudioError('INTERNAL', 'Configure MOTION_STUDIO_AGENT_PUBLIC_URL with the public HTTPS Transovo origin.', 503)
  }
  return url.origin
}

export function agentBridgeConfigured(): boolean {
  return !!(process.env.GROKBOT_WEBHOOK_URL && process.env.GROKBOT_WEBHOOK_KEY)
}
export function agentBridgeLive(): boolean { return process.env.GROKBOT_LIVE_MODE === '1' }

type PublicJob = {
  id: string; projectId: string; status: string; phase: string; progress: number;
  message: string | null; resultKey: string | null; createdAt: Date; updatedAt: Date;
  completedAt: Date | null; artifacts: unknown
}
function publicJob(job: PublicJob) {
  return { id: job.id, projectId: job.projectId, status: job.status, phase: job.phase,
    progress: job.progress, message: job.message, createdAt: job.createdAt.toISOString(),
    updatedAt: job.updatedAt.toISOString(), completedAt: job.completedAt?.toISOString() ?? null,
    artifacts: artifacts(job.artifacts).filter(a => a.state === 'ready')
      .map(a => ({ id: a.id, kind: a.kind, filename: a.filename, bytes: a.bytes })) }
}

export async function userAgentJob(workspaceId: string, projectId: string, userId: string) {
  const project = await db().motionStudioProject.findFirst({ where: { workspaceId, id: projectId, userId }, select: { id: true } })
  if (!project) throw new MotionStudioError('NOT_FOUND', 'Project not found.', 404)
  const job = await db().motionStudioAgentJob.findFirst({ where: { workspaceId, projectId }, orderBy: { createdAt: 'desc' } })
  if (!job) return null
  const videoUrl = job.status === 'complete' && job.resultKey
    ? await createReadableSignedUrl(job.resultKey, 3600).catch(() => null) : null
  return { ...publicJob(job), videoUrl }
}

export async function dispatchAgentJob(workspaceId: string, userId: string, projectId: string, key: string | null, request: Request) {
  if (!agentBridgeConfigured()) throw new MotionStudioError('INTERNAL', 'Grokbot webhook is not configured.', 503)
  const project = await db().motionStudioProject.findFirst({
    where: { workspaceId, id: projectId }, select: { id: true, userId: true, brief: true, title: true, settings: true, status: true },
  })
  if (!project) throw new MotionStudioError('NOT_FOUND', 'Project not found.', 404)
  if (project.userId !== userId) throw new MotionStudioError('FORBIDDEN', 'Project owner required.', 403)
  if (project.status !== 'setup') throw new MotionStudioError('CONFLICT', 'The old production pipeline has started.', 409)
  const idempotencyKey = str(key, 120) || 'initial-production'
  const where = { projectId_idempotencyKey: { projectId, idempotencyKey } }
  const previous = await db().motionStudioAgentJob.findUnique({ where })
  if (previous) return publicJob(previous)
  const id = 'msaj_' + randomUUID()
  const token = randomBytes(32).toString('base64url')
  const tokenHash = sha(id + ':' + token).toString('hex')
  let job
  try {
    job = await db().motionStudioAgentJob.create({ data: { id, projectId, workspaceId, userId,
      idempotencyKey, tokenHash, tokenExpiresAt: new Date(Date.now() + 36 * 3600_000),
      status: 'dispatching', phase: 'dispatch', progress: 0, artifacts: toPrismaJson([]),
      message: 'Submitting assignment to the production bot.' } })
  } catch (err) {
    if ((err as { code?: string })?.code !== 'P2002') throw err
    const duplicate = await db().motionStudioAgentJob.findUnique({ where })
    if (!duplicate) throw err
    return publicJob(duplicate)
  }
  const rawUrl = process.env.GROKBOT_WEBHOOK_URL!
  const webhook = new URL(rawUrl)
  if (webhook.protocol !== 'https:') throw new MotionStudioError('INTERNAL', 'Grokbot webhook requires HTTPS.', 503)
  const settings = toObject(project.settings)
  const endpoint = baseUrl(request) + '/api/motion-studio/agent/jobs/' + encodeURIComponent(id)
  const payload = {
    version: 1, jobId: id, projectId, action: 'create_video', title: project.title, prompt: project.brief,
    durationSeconds: Math.round((Number(settings.lengthMin) || 3) * 60),
    aspectRatio: str(settings.format, 30).split('_')[0] || '16:9',
    jobUrl: endpoint, callbackUrl: endpoint, setupMode: !agentBridgeLive(),
    // During setup do not disclose a callback token in the bot's diagnostic chat.
    ...(agentBridgeLive() ? { jobToken: token } : {}),
  }
  try {
    const response = await fetch(rawUrl, { method: 'POST', cache: 'no-store', redirect: 'error',
      headers: { Authorization: 'Bearer ' + process.env.GROKBOT_WEBHOOK_KEY!, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload), signal: AbortSignal.timeout(15_000) })
    if (response.status !== 200) throw new Error('Webhook HTTP ' + response.status)
    job = await db().motionStudioAgentJob.update({ where: { id }, data: { status: 'dispatched', phase: 'accepted',
      dispatchedAt: new Date(), message: agentBridgeLive() ? 'Bot accepted the production request.' : 'Setup-mode job received; rendering is disabled.' } })
    await db().studioActivityEvent.create({ data: { projectId, stage: 'story', kind: 'stage',
      message: 'Agent webhook accepted' + (agentBridgeLive() ? '.' : ' (setup mode).') } })
    console.info('[motion-studio:agent] dispatched', { jobId: id, projectId, setupMode: !agentBridgeLive() })
  } catch (err) {
    job = await db().motionStudioAgentJob.update({ where: { id }, data: { status: 'dispatch_failed',
      phase: 'dispatch', message: 'The agent webhook did not accept the job.' } })
    console.error('[motion-studio:agent] dispatch_failed', { jobId: id, kind: err instanceof Error ? err.name : typeof err })
  }
  return publicJob(job)
}

export async function requireBotJob(id: string, request: Request) {
  const auth = request.headers.get('authorization') || ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''
  if (!token || token.length > 256) throw new MotionStudioError('UNAUTHENTICATED', 'Job bearer token required.', 401)
  const job = await db().motionStudioAgentJob.findUnique({ where: { id } })
  if (!job || job.tokenExpiresAt.getTime() <= Date.now()) throw new MotionStudioError('UNAUTHENTICATED', 'Expired or invalid token.', 401)
  const given = sha(id + ':' + token)
  const expected = Buffer.from(job.tokenHash, 'hex')
  if (expected.length !== given.length || !timingSafeEqual(given, expected)) {
    throw new MotionStudioError('UNAUTHENTICATED', 'Invalid token.', 401)
  }
  return job
}

export async function botGetAssignment(id: string, request: Request) {
  const job = await requireBotJob(id, request)
  const project = await db().motionStudioProject.findFirst({ where: { id: job.projectId, workspaceId: job.workspaceId },
    select: { title: true, brief: true, workflow: true, settings: true } })
  if (!project) throw new MotionStudioError('NOT_FOUND', 'Project not found.', 404)
  const projectAssets = await db().studioAsset.findMany({ where: { projectId: job.projectId, workspaceId: job.workspaceId } })
  const uploads = await db().clipUpload.findMany({ where: { id: { in: projectAssets.map(a => a.uploadId) }, workspaceId: job.workspaceId } })
  const inputs = await Promise.all(uploads.map(async upload => ({
    filename: upload.filename, mime: upload.mime,
    url: await createReadableSignedUrl(upload.key, 1800).catch(() => null),
  })))
  return { ...publicJob(job), title: project.title, prompt: project.brief,
    settings: project.settings, workflow: project.workflow, inputs }
}

export async function botProgress(id: string, request: Request, raw: unknown) {
  const job = await requireBotJob(id, request)
  if (isDone(job.status)) throw new MotionStudioError('CONFLICT', 'Job already finished.', 409)
  const input = toObject(raw)
  const proposed = Number(input.progress)
  const progress = Number.isFinite(proposed) ? Math.max(job.progress, Math.min(99, Math.round(proposed))) : job.progress
  const phase = str(input.phase, 60) || 'production'
  const message = str(input.message, 500)
  const updated = await db().motionStudioAgentJob.update({ where: { id },
    data: { status: 'running', phase, progress, message } })
  await db().studioActivityEvent.create({ data: { projectId: job.projectId, stage: 'graphics',
    kind: 'stage', message: message || phase } })
  return publicJob(updated)
}

export async function botAssets(id: string, request: Request, raw: unknown) {
  const job = await requireBotJob(id, request)
  if (isDone(job.status)) throw new MotionStudioError('CONFLICT', 'Job already finished.', 409)
  const input = toObject(raw)
  const action = str(input.action, 20)
  const all = artifacts(job.artifacts)
  if (action === 'prepare') {
    const filename = str(input.filename, 150).replace(/[^a-zA-Z0-9._-]/g, '_')
    const kind = str(input.kind, 30), mime = str(input.mime, 80), bytes = Number(input.bytes)
    if (!filename || !['video', 'project', 'media', 'audio', 'source'].includes(kind)
      || !['video/mp4', 'application/json', 'image/png', 'image/jpeg', 'audio/mpeg', 'audio/wav', 'application/zip'].includes(mime)
      || !Number.isSafeInteger(bytes) || bytes < 1 || bytes > MAX_FILE || all.length >= 100) {
      throw new MotionStudioError('INVALID', 'Invalid artifact details.', 400)
    }
    const uploadId = randomUUID()
    const objectKey = 'ws/' + job.workspaceId + '/motion-studio/agent/' + job.id + '/' + uploadId + '/' + filename
    const upload = await getClipStorage().createUpload({ workspaceId: job.workspaceId, uploadId,
      filename, mime, bytes, objectKey })
    const item: Artifact = { id: uploadId, key: objectKey, kind, filename, mime, bytes, state: 'pending',
      ...(upload.s3Multipart ? { s3UploadId: upload.s3Multipart.uploadId } : {}) }
    await db().motionStudioAgentJob.update({ where: { id },
      data: { artifacts: toPrismaJson([...all, item]) } })
    return { uploadId, objectKey, mode: upload.mode, signedPut: upload.signedPut,
      tus: upload.tus, s3Multipart: upload.s3Multipart }
  }
  if (action === 'commit') {
    const item = all.find(a => a.id === str(input.uploadId, 100))
    if (!item) throw new MotionStudioError('NOT_FOUND', 'Upload not prepared for job.', 404)
    if (item.state === 'ready') return { uploadId: item.id, status: 'ready' }
    const parts = Array.isArray(input.parts) ? input.parts.slice(0, 1000).map(p => {
      const x = toObject(p); return { partNumber: Number(x.partNumber), etag: str(x.etag, 256) }
    }) : []
    if (item.s3UploadId && (!parts.length || parts.some(p => !Number.isSafeInteger(p.partNumber) || p.partNumber < 1 || !p.etag))) {
      throw new MotionStudioError('INVALID', 'Multipart ETags required.', 400)
    }
    const storage = getClipStorage()
    await storage.completeUpload({ objectKey: item.key, s3UploadId: item.s3UploadId, parts })
    const size = await storage.getObjectSizeBytes(item.key)
    if (!size || size > MAX_FILE) throw new MotionStudioError('INVALID', 'Uploaded object is missing or invalid.', 400)
    item.state = 'ready'
    await db().motionStudioAgentJob.update({ where: { id }, data: { artifacts: toPrismaJson(all) } })
    return { uploadId: item.id, status: 'ready', bytes: size }
  }
  throw new MotionStudioError('INVALID', 'Expected prepare or commit.', 400)
}

export async function botFinish(id: string, request: Request, raw: unknown) {
  const job = await requireBotJob(id, request)
  if (job.status === 'complete') return publicJob(job)
  if (isDone(job.status)) throw new MotionStudioError('CONFLICT', 'Job already finished.', 409)
  const input = toObject(raw)
  if (input.status === 'failed') {
    const message = str(input.message, 500) || 'Production failed.'
    const failed = await db().motionStudioAgentJob.update({ where: { id },
      data: { status: 'failed', phase: 'failed', message, completedAt: new Date() } })
    return publicJob(failed)
  }
  const video = artifacts(job.artifacts).find(a => a.kind === 'video' && a.mime === 'video/mp4' && a.state === 'ready')
  if (!video) throw new MotionStudioError('CONFLICT', 'Upload and commit an MP4 before completing.', 409)
  const durationMs = Number(input.durationMs)
  if (!Number.isSafeInteger(durationMs) || durationMs <= 0 || durationMs > 2_147_483_647) {
    throw new MotionStudioError('INVALID', 'Rendered durationMs required.', 400)
  }
  const now = new Date()
  const completed = await db().$transaction(async tx => {
    const result = await tx.motionStudioAgentJob.update({ where: { id }, data: { status: 'complete',
      phase: 'complete', progress: 100, message: 'Video ready.', resultKey: video.key, completedAt: now } })
    const motionProject = await tx.motionStudioProject.findUnique({ where: { id: job.projectId },
      select: { clipProjectId: true } })
    await tx.motionStudioProject.update({ where: { id: job.projectId }, data: { status: 'review',
      stage: 'review', completedAt: now, exportInfo: toPrismaJson({
        masterKey: video.key, smallKey: video.key, durationMs, source: 'grokbot_agent',
        storageDriver: storageDriverName(),
      }) } })
    // The initial Motion Studio project creates an empty editor canvas. Attach
    // the bot's actual MP4 to that project's source upload so the existing
    // Compact Editor can preview, trim, split, and layer over the video.
    if (motionProject?.clipProjectId) {
      const clipProject = await tx.clipProject.findUnique({ where: { id: motionProject.clipProjectId },
        select: { uploadId: true } })
      if (clipProject?.uploadId) {
        await tx.clipUpload.update({ where: { id: clipProject.uploadId }, data: {
          key: video.key, bytes: BigInt(video.bytes), durationMs, mime: 'video/mp4',
          filename: video.filename, status: 'READY', storageDriver: storageDriverName(),
        } })
      }
      await tx.clipProject.update({ where: { id: motionProject.clipProjectId }, data: {
        status: 'READY', stage: 'motion_studio', progress: 100,
        rangeEndMs: durationMs, proxyKey: video.key,
      } })
    }
    await tx.studioActivityEvent.create({ data: { projectId: job.projectId, stage: 'review',
      kind: 'stage', message: 'Grokbot video received and ready for preview.' } })
    return result
  })
  return publicJob(completed)
}
