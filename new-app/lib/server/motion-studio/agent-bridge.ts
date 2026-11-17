import 'server-only'
import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto'
import { getPrisma } from '@/lib/server/db'
import { createReadableSignedUrl, getClipStorage, storageDriverName } from '@/lib/storage'
import { toPrismaJson } from '@/lib/server/clips/prisma-json'
import { MotionStudioError } from '@/lib/server/motion-studio/errors'
import { sanitizeCreativeBrief, directorCategoryGuidance } from '@/lib/motion-studio/creative-options'

const db = () => getPrisma()
const toObject = (x: unknown): Record<string, unknown> => x && typeof x === 'object' && !Array.isArray(x) ? x as Record<string, unknown> : {}
const str = (x: unknown, max = 4000): string => typeof x === 'string' ? x.trim().slice(0, max) : ''
const sha = (x: string): Buffer => createHash('sha256').update(x).digest()
const MAX_FILE = 2_000_000_000
type Artifact = { id: string; key: string; kind: string; filename: string; mime: string; bytes: number; state: 'pending' | 'ready'; s3UploadId?: string; elementId?: string; trackId?: string }
const artifacts = (raw: unknown): Artifact[] => Array.isArray(raw) ? raw as Artifact[] : []
const isDone = (status: string) => ['complete', 'failed', 'dispatch_failed', 'cancelled'].includes(status)
const CUSTOMER_STAGES = ['research','story','voice','scenes','review','fixing','rendering','delivering','complete'] as const
const DEFAULT_STAGE_MESSAGES: Record<string, string> = { research: "We're finding the best photos and clips…", story: "We're writing your story…", voice: "We're recording narration…", scenes: "We're building your scenes…", review: "We're reviewing the cut…", fixing: "We're polishing a few details…", rendering: "We're rendering your final video…", delivering: "We're adding the video to your timeline…", complete: "Done! Your film is ready to edit." }
function friendlyMessage(raw: unknown, stage: string): string {
  const message = str(raw, 240)
  if (!message || /grok|bot\b|model|engine|\/workspace|\/tmp\/|https?:\/\/|token|stack trace|api[_ -]?key|\$\d|usd|ffmpeg|python|exception|traceback/i.test(message)) return DEFAULT_STAGE_MESSAGES[stage] || "We're working on your video…"
  return message
}

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
  completedAt: Date | null; artifacts: unknown; parentJobId?: string | null; revision?: number
}
function publicJob(job: PublicJob) {
  return { id: job.id, projectId: job.projectId, status: job.status, phase: job.phase,
    parentJobId: job.parentJobId ?? null, revision: job.revision ?? 0,
    progress: job.progress, message: job.message, createdAt: job.createdAt.toISOString(),
    updatedAt: job.updatedAt.toISOString(), completedAt: job.completedAt?.toISOString() ?? null,
    artifacts: artifacts(job.artifacts).filter(a => a.state === 'ready')
      .map(a => ({ id: a.id, kind: a.kind, filename: a.filename, bytes: a.bytes })) }
}

export async function userAgentJob(workspaceId: string, projectId: string, _userId: string) {
  const project = await db().motionStudioProject.findFirst({ where: { workspaceId, id: projectId }, select: { id: true, exportInfo: true } })
  if (!project) throw new MotionStudioError('NOT_FOUND', 'Project not found.', 404)
  const latest = await db().motionStudioAgentJob.findFirst({ where: { workspaceId, projectId }, orderBy: { createdAt: 'desc' } })
  const selectedJobId = str(toObject(project.exportInfo).agentJobId, 100)
  const selected = selectedJobId ? await db().motionStudioAgentJob.findFirst({ where: {
    id: selectedJobId, workspaceId, projectId, status: 'complete' } }) : null
  const job = latest && ['dispatching','dispatched','running','needs_input'].includes(latest.status)
    ? latest : selected ?? latest
  if (!job) return null
  const previousVideo = !job.resultKey && job.parentJobId
    ? await db().motionStudioAgentJob.findFirst({ where: { id: job.parentJobId,
      workspaceId, projectId, status: 'complete' }, select: { resultKey: true } }) : null
  const activeVideoKey = job.resultKey || previousVideo?.resultKey
  const videoUrl = activeVideoKey ? await createReadableSignedUrl(activeVideoKey, 3600).catch(() => null) : null
  const events = await db().studioActivityEvent.findMany({ where: { projectId, kind: 'agent_progress' }, orderBy: { id: 'asc' }, take: 500 })
  return { ...publicJob(job), phase: CUSTOMER_STAGES.includes(job.phase as typeof CUSTOMER_STAGES[number]) ? job.phase : 'research', message: friendlyMessage(job.message, job.phase), videoUrl,
    stages: CUSTOMER_STAGES, events: events.filter(e => toObject(e.data).jobId === job.id).map(e => ({ id: e.id, stage: e.stage, message: e.message, timestamp: e.createdAt.toISOString(), sceneId: str(toObject(e.data).sceneId, 80) || undefined, percent: toObject(e.data).percent })) }
}

export type RevisionRequest = { instruction: string; selectedElementIds?: string[]; timeRangeMs?: [number, number] }
export async function dispatchAgentJob(workspaceId: string, userId: string, projectId: string, key: string | null, request: Request, revisionRequest?: RevisionRequest) {
  if (!agentBridgeConfigured()) throw new MotionStudioError('INTERNAL', 'Grokbot webhook is not configured.', 503)
  const project = await db().motionStudioProject.findFirst({
    where: { workspaceId, id: projectId }, select: { id: true, userId: true, brief: true, title: true, settings: true, status: true },
  })
  if (!project) throw new MotionStudioError('NOT_FOUND', 'Project not found.', 404)
  // No-login Motion Studio testing: the pinned workspace is the project scope.
  // Before public paid production, restore per-tenant authorization.
  if (!revisionRequest && project.status !== 'setup') throw new MotionStudioError('CONFLICT', 'The old production pipeline has started.', 409)
  const parent = revisionRequest ? await db().motionStudioAgentJob.findFirst({
    where: { workspaceId, projectId, status: 'complete' }, orderBy: [{ revision: 'desc' }, { createdAt: 'desc' }] }) : null
  if (revisionRequest && !parent) throw new MotionStudioError('CONFLICT', 'Finish a video before requesting edits.', 409)
  const idempotencyKey = str(key, 120) || 'initial-production'
  const where = { projectId_idempotencyKey: { projectId, idempotencyKey } }
  const previous = await db().motionStudioAgentJob.findUnique({ where })
  if (previous) return publicJob(previous)
  // Until billing and a proper tenant quota are connected, refuse unlimited
  // public webhook dispatch. This also bounds setup-mode routine usage.
  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)
  const jobsToday = await db().motionStudioAgentJob.count({
    where: { userId, createdAt: { gte: today } },
  })
  if (jobsToday >= (revisionRequest ? 12 : 3)) throw new MotionStudioError('CONFLICT', 'Daily testing limit reached.', 429)
  const active = await db().motionStudioAgentJob.count({
    where: { userId, status: { in: ['dispatching', 'dispatched', 'running'] } },
  })
  if (active >= 3) throw new MotionStudioError('CONFLICT', 'Maximum concurrent agent jobs reached.', 429)
  const id = 'msaj_' + randomUUID()
  const token = randomBytes(32).toString('base64url')
  const tokenHash = sha(id + ':' + token).toString('hex')
  let job
  try {
    job = await db().motionStudioAgentJob.create({ data: { id, projectId, workspaceId, userId,
      idempotencyKey, parentJobId: parent?.id ?? null, revision: parent ? parent.revision + 1 : 0,
      tokenHash, tokenExpiresAt: new Date(Date.now() + 36 * 3600_000),
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
  const creative = sanitizeCreativeBrief(settings.creative)
  const endpoint = baseUrl(request) + '/api/motion-studio/agent/jobs/' + encodeURIComponent(id)
  const payload = {
    version: 1, jobId: id, projectId, action: revisionRequest ? 'revise_video' : 'create_video',
    ...(parent ? { parentJobId: parent.id, revision: parent.revision + 1, threadId: projectId,
      instruction: revisionRequest?.instruction,
      selectedElementIds: revisionRequest?.selectedElementIds ?? [],
      timeRangeMs: revisionRequest?.timeRangeMs ?? null,
      messageHistory: (await db().motionStudioAgentMessage.findMany({ where: { projectId },
        orderBy: { createdAt: 'desc' }, take: 20 })).reverse().map(m => ({ role: m.role, text: m.text })) } : {}),
    title: project.title, prompt: project.brief,
    videoType: creative.videoType,
    categoryGuidance: directorCategoryGuidance(creative.videoType),
    creative: { ...creative, brand: creative.brandMode === 'none' ? undefined : creative.brand },
    // Original prompt always remains intact; creative guidance is separate, never a scene template.
    durationSeconds: [30,60,120,180,300].includes(Number(settings.durationSeconds))
      ? Number(settings.durationSeconds) : Math.round((Number(settings.lengthMin) || 3) * 60),
    aspectRatio: str(settings.format, 30).split('_')[0] || '16:9',
    ...(() => {
      const size = str(settings.finalRenderSize || settings.renderSize || str(settings.format).split('_')[1], 40) || '480p'
      const height = ({'480p':480,'720p':720,'1080p':1080,'2160p':2160} as Record<string,number>)[size] || 480
      const ar = str(settings.format).split('_')[0]
      const width = Math.round(height * (ar === '9:16' ? 9 / 16 : ar === '1:1' ? 1 : 16 / 9) / 2) * 2
      return { width, height, fps: 30, resolution: size }
    })(),
    quality: str(settings.quality || settings.tier, 40) || 'premium',
    style: str(settings.visualDirection, 80) || 'cinematic',
    webResearch: true,
    mediaPolicy: 'auto_plus_uploads',
    jobUrl: endpoint, callbackUrl: endpoint, setupMode: !agentBridgeLive(),
    // During setup do not disclose a callback token in the bot's diagnostic chat.
    ...(agentBridgeLive() ? { jobToken: token } : {}),
  }
  try {
    // Reuse the exact same jobId and callback token on retries; the producer must
    // treat repeated deliveries as one assignment.
    let accepted = false
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const response = await fetch(rawUrl, { method: 'POST', cache: 'no-store', redirect: 'error',
          headers: { Authorization: 'Bearer ' + process.env.GROKBOT_WEBHOOK_KEY!, 'Content-Type': 'application/json' },
          body: JSON.stringify(payload), signal: AbortSignal.timeout(15_000) })
        if (response.ok) { accepted = true; break }
        if (response.status < 500 && response.status !== 429) break
      } catch { /* Network failures may be retried with this job's stable ID. */ }
      if (attempt < 2) await new Promise(resolve => setTimeout(resolve, 300 * 2 ** attempt))
    }
    if (!accepted) throw new Error('Webhook not accepted')
    job = await db().motionStudioAgentJob.update({ where: { id }, data: { status: 'dispatched', phase: 'accepted',
      dispatchedAt: new Date(), message: agentBridgeLive() ? (revisionRequest ? "We're updating your video…" : "We're preparing your video…") : 'Setup-mode job received; rendering is disabled.' } })
    await db().studioActivityEvent.create({ data: { projectId, stage: 'story', kind: 'stage',
      message: 'Transovo Agent accepted your request' + (agentBridgeLive() ? '.' : ' (setup mode).') } })
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
  const requestedStage = str(input.stage || input.phase, 60)
  const phase = (CUSTOMER_STAGES as readonly string[]).includes(requestedStage) ? requestedStage : 'scenes'
  const proposed = Number(input.percent ?? input.progress)
  const progress = Number.isFinite(proposed) ? Math.max(job.progress, Math.min(99, Math.round(proposed))) : job.progress
  const message = friendlyMessage(input.message, phase)
  const sceneId = str(input.sceneId, 80)
  const updated = await db().motionStudioAgentJob.update({ where: { id },
    data: { status: 'running', phase, progress, message } })
  await db().studioActivityEvent.create({ data: { projectId: job.projectId, stage: phase,
    kind: 'agent_progress', message, data: toPrismaJson({ jobId: id, percent: progress, ...(sceneId ? {sceneId} : {}) }) } })
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
    const elementId = str(input.elementId, 100), trackId = str(input.trackId, 100)
    if (!filename || !['video', 'project', 'media', 'audio', 'source'].includes(kind)
      || !['video/mp4', 'video/webm', 'video/quicktime', 'application/json', 'image/png', 'image/jpeg', 'audio/mpeg', 'audio/wav', 'audio/x-wav', 'audio/mp4', 'text/plain', 'application/x-subrip', 'application/zip'].includes(mime)
      || !Number.isSafeInteger(bytes) || bytes < 1 || bytes > MAX_FILE || all.length >= 300) {
      throw new MotionStudioError('INVALID', 'Invalid artifact details.', 400)
    }
    const uploadId = randomUUID()
    const objectKey = 'ws/' + job.workspaceId + '/motion-studio/agent/' + job.id + '/' + uploadId + '/' + filename
    const upload = await getClipStorage().createUpload({ workspaceId: job.workspaceId, uploadId,
      filename, mime, bytes, objectKey })
    const item: Artifact = { id: uploadId, key: objectKey, kind, filename, mime, bytes, state: 'pending',
      ...(upload.s3Multipart ? { s3UploadId: upload.s3Multipart.uploadId } : {}),
      ...(elementId ? { elementId } : {}), ...(trackId ? { trackId } : {}) }
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
    const message = "We hit a snag finishing your video. Please try again."
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
      phase: 'complete', progress: 100, message: DEFAULT_STAGE_MESSAGES.complete, resultKey: video.key, durationMs, completedAt: now } })
    const motionProject = await tx.motionStudioProject.findUnique({ where: { id: job.projectId },
      select: { clipProjectId: true } })
    await tx.motionStudioProject.update({ where: { id: job.projectId }, data: { status: 'review',
      stage: 'review', completedAt: now, timelineVersion: { increment: 1 }, exportInfo: toPrismaJson({
        masterKey: video.key, smallKey: video.key, durationMs, source: 'transovo_agent', agentJobId: id,
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
      kind: 'stage', message: DEFAULT_STAGE_MESSAGES.complete } })
    return result
  })
  if (job.parentJobId) {
    await db().motionStudioAgentMessage.create({ data: { id:'msmsg_' + randomUUID(),
      projectId:job.projectId,jobId:id,role:'agent',
      text:friendlyMessage(input.summary || "We've finished your changes. The updated version is ready.",'complete') } })
  }
  await db().studioActivityEvent.create({ data: { projectId: job.projectId, stage: 'complete', kind: 'agent_progress', message: DEFAULT_STAGE_MESSAGES.complete,
    data: toPrismaJson({ jobId: id, percent: 100 }) } })
  return publicJob(completed)
}


/** Workspace-scoped persisted customer conversation, independent of production-run retries. */
export async function agentThread(workspaceId: string, projectId: string) {
  const project = await db().motionStudioProject.findFirst({ where: { id: projectId, workspaceId }, select: { id: true, exportInfo: true } })
  if (!project) throw new MotionStudioError('NOT_FOUND', 'Project not found.', 404)
  const [messages, jobs] = await Promise.all([
    db().motionStudioAgentMessage.findMany({ where: { projectId }, orderBy: { createdAt: 'asc' }, take: 250 }),
    db().motionStudioAgentJob.findMany({ where: { workspaceId, projectId, status: 'complete' },
      select: { id: true, revision: true, durationMs: true, createdAt: true }, orderBy: { revision: 'asc' } }),
  ])
  return { threadId: projectId, activeJobId: str(toObject(project.exportInfo).agentJobId, 100) || jobs.at(-1)?.id || null, messages: messages.map(m=>({ id:m.id,role:m.role,text:m.text,
    timestamp:m.createdAt.toISOString(),jobId:m.jobId })),
    versions: jobs.map(j=>({ jobId:j.id,revision:j.revision,durationMs:j.durationMs,createdAt:j.createdAt.toISOString() })) }
}

export async function submitAgentRevision(workspaceId: string, userId: string, projectId: string, request: Request, raw: unknown) {
  const input = toObject(raw)
  const instruction = str(input.instruction || input.text, 2500)
  if (instruction.length < 2) throw new MotionStudioError('INVALID', 'Tell Transovo what to change.', 400)
  const selectedElementIds = Array.isArray(input.selectedElementIds)
    ? input.selectedElementIds.slice(0,20).map(v=>str(v,80)).filter(Boolean) : []
  const times = Array.isArray(input.timeRangeMs) ? input.timeRangeMs.map(Number) : []
  const timeRangeMs: [number,number] | undefined = times.length === 2 && times.every(Number.isSafeInteger) &&
    times[0] >= 0 && times[1] > times[0] ? [times[0],times[1]] : undefined
  const existing = await db().motionStudioProject.findFirst({ where: { id: projectId, workspaceId }, select: { id: true } })
  if (!existing) throw new MotionStudioError('NOT_FOUND', 'Project not found.', 404)
  const key = str(request.headers.get('Idempotency-Key'),120) || 'revision-' + randomUUID()
  const prior = await db().motionStudioAgentJob.findUnique({ where: { projectId_idempotencyKey: {
    projectId, idempotencyKey: key } } })
  if (prior) return publicJob(prior)
  const message = await db().motionStudioAgentMessage.create({ data: { id: 'msmsg_' + randomUUID(),
    projectId, role: 'customer', text: instruction } })
  const job = await dispatchAgentJob(workspaceId,userId,projectId,key,request,{instruction,selectedElementIds,timeRangeMs})
  await db().motionStudioAgentMessage.update({ where: { id: message.id }, data: { jobId: job.id } })
  return job
}

export async function botPostMessage(id: string, request: Request, raw: unknown) {
  const job = await requireBotJob(id,request)
  const input = toObject(raw)
  const text = friendlyMessage(input.text, 'review')
  if (!str(input.text,2000)) throw new MotionStudioError('INVALID','Message required.',400)
  const item = await db().motionStudioAgentMessage.create({ data: { id:'msmsg_'+randomUUID(),
    projectId:job.projectId,jobId:id,role:'agent',text } })
  if (input.needsInput === true && !isDone(job.status)) {
    await db().motionStudioAgentJob.update({ where: { id }, data: {
      status: 'needs_input', tokenExpiresAt: new Date(Date.now() + 36*3600_000),
      message: "We're waiting for your direction…" } })
  }
  return { id:item.id, role:'agent',text:item.text,timestamp:item.createdAt.toISOString() }
}

/** A revision's bearer token can retrieve only its own declared parent artifacts. */
export async function botParentArtifacts(id: string, request: Request) {
  const job = await requireBotJob(id,request)
  if (!job.parentJobId) throw new MotionStudioError('NOT_FOUND','No parent version.',404)
  const parent = await db().motionStudioAgentJob.findFirst({ where: {
    id:job.parentJobId, projectId:job.projectId, workspaceId:job.workspaceId,status:'complete' } })
  if (!parent) throw new MotionStudioError('NOT_FOUND','Previous version unavailable.',404)
  const list = artifacts(parent.artifacts).filter(a=>a.state==='ready').slice(0,300)
  return { parentJobId:parent.id,revision:parent.revision, artifacts: await Promise.all(list.map(async a => ({
    id:a.id,elementId:a.elementId,trackId:a.trackId,filename:a.filename,kind:a.kind,mime:a.mime,
    url:await createReadableSignedUrl(a.key,900).catch(()=>null) }))) }
}

/** Excludes bot secrets and URLs from logs and any public progress response. */
export async function cancelAgentJob(workspaceId: string, projectId: string, id: string) {
  const job = await db().motionStudioAgentJob.findFirst({ where: { id,projectId,workspaceId } })
  if (!job) throw new MotionStudioError('NOT_FOUND','Job not found.',404)
  if (isDone(job.status)) return publicJob(job)
  const updated = await db().motionStudioAgentJob.update({ where:{id},data:{
    status:'cancelled',phase:'cancelled',message:'Production cancelled.',completedAt:new Date() } })
  if (agentBridgeConfigured()) {
    const url = process.env.GROKBOT_WEBHOOK_URL!
    // Best effort; cancellation is also visible through GET /jobs/:id polling.
    try {
      await fetch(url,{method:'POST',redirect:'error',headers:{Authorization:'Bearer '+process.env.GROKBOT_WEBHOOK_KEY!,
        'Content-Type':'application/json'},body:JSON.stringify({action:'cancel',jobId:id}),
        signal:AbortSignal.timeout(5000)})
    } catch { /* The persisted cancellation status is authoritative. */ }
  }
  return publicJob(updated)
}


/** Restore a completed version without deleting later versions or their scene assets. */
export async function restoreAgentVersion(workspaceId: string, projectId: string, jobId: string) {
  const dbi = db()
  const project = await dbi.motionStudioProject.findFirst({ where: { id: projectId, workspaceId },
    select: { clipProjectId:true,exportInfo:true } })
  if (!project?.clipProjectId) throw new MotionStudioError('NOT_FOUND','Project not found.',404)
  const job = await dbi.motionStudioAgentJob.findFirst({ where: {
    id: jobId, projectId, workspaceId, status:'complete' } })
  if (!job?.resultKey) throw new MotionStudioError('NOT_FOUND','That version is unavailable.',404)
  const asset = artifacts(job.artifacts).find(a => a.state === 'ready' && a.key === job.resultKey)
  if (!asset) throw new MotionStudioError('CONFLICT','That version has no completed MP4.',409)
  const durationMs = job.durationMs || Number(toObject(project.exportInfo).durationMs) || 0
  if (!Number.isSafeInteger(durationMs) || durationMs <= 0) throw new MotionStudioError('CONFLICT','Version duration is unavailable.',409)
  const source = await dbi.clipProject.findFirst({ where: { id:project.clipProjectId,workspaceId },
    select:{uploadId:true} })
  await dbi.$transaction(async tx => {
    await tx.motionStudioProject.update({ where:{id:projectId},data:{
      status:'review',stage:'review',timelineVersion:{increment:1},exportInfo:toPrismaJson({
        masterKey:job.resultKey,smallKey:job.resultKey,durationMs,source:'transovo_agent',
        agentJobId:jobId,storageDriver:storageDriverName()
      }) } })
    if (source?.uploadId) await tx.clipUpload.update({ where: { id:source.uploadId }, data:{
      key:job.resultKey,bytes:BigInt(asset.bytes),filename:asset.filename,mime:'video/mp4',
      durationMs,status:'READY',storageDriver:storageDriverName() } })
    await tx.clipProject.update({ where:{id:project.clipProjectId!},data:{
      status:'READY',rangeEndMs:durationMs,proxyKey:job.resultKey,progress:100 } })
  })
  return { activeJobId:jobId,revision:job.revision }
}


/** Private operational telemetry; never included in publicJob or customer chat. */
export async function botRecordUsage(id: string, request: Request, raw: unknown) {
  const job = await requireBotJob(id, request)
  const input = toObject(raw)
  if (!Array.isArray(input.items)) throw new MotionStudioError('INVALID','Usage items required.',400)
  const items = input.items.slice(0,100).map(v=>{
    const item = toObject(v)
    const provider = str(item.provider,80)
    const units = Number(item.units), usd = Number(item.usd)
    if (!provider || !Number.isFinite(units) || units < 0 || !Number.isFinite(usd) || usd < 0)
      throw new MotionStudioError('INVALID','Invalid usage item.',400)
    return {provider,units,usd}
  })
  const updated = await db().motionStudioAgentJob.update({ where:{id},data:{usage:toPrismaJson({
    items,recordedAt:new Date().toISOString()
  }) } })
  return {jobId:updated.id,stored:true}
}
