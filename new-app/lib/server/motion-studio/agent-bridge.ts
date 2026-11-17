import 'server-only'
import { createHash, createHmac, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto'
import { getPrisma } from '@/lib/server/db'
import { coordinatorEnabled, coordinatePendingJobs } from '@/lib/server/motion-studio/coordinator'
import { createReadableSignedUrl, getClipStorage, storageDriverName } from '@/lib/storage'
import { toPrismaJson } from '@/lib/server/clips/prisma-json'
import { MotionStudioError } from '@/lib/server/motion-studio/errors'
import { interpretCustomerMessage } from '@/lib/server/motion-studio/chat-assistant'
import { isStatusQuestion, statusReply, publicAssistantText } from '@/lib/motion-studio/chat-intent'
import { customerQuestion, progressMayChangeWaiting, waitingExpired, CUSTOMER_WAIT_MS } from '@/lib/motion-studio/waiting-contract'
import { sanitizeCreativeBrief, directorCategoryGuidance } from '@/lib/motion-studio/creative-options'
import { validateProducerCheckpoint } from '@/lib/motion-studio/checkpoint-contract'
import { pullProducerQueueEnabled, pullProducerQueueConfigured, releaseProducerLease } from '@/lib/server/motion-studio/producer-queue'

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
  completedAt: Date | null; waitingStartedAt?: Date | null; artifacts: unknown; parentJobId?: string | null; revision?: number
}
async function expireStaleQuestion<T extends { id: string; status: string; waitingStartedAt?: Date | null }>(job: T): Promise<T> {
  if (job.status !== 'needs_input' || !waitingExpired(job.waitingStartedAt || (job as T & { updatedAt?: Date }).updatedAt || new Date())) return job
  // Lazy fail-safe: enforced whenever client or producer polls the job. The producer
  // may choose an earlier best-effort continuation on its own 24-hour clock.
  const deadline = new Date(Date.now() - CUSTOMER_WAIT_MS)
  const result = await db().motionStudioAgentJob.updateMany({
    where: { id: job.id, status: 'needs_input',
      OR: [{ waitingStartedAt: { lte: deadline } }, { waitingStartedAt: null, updatedAt: { lte: deadline } }] },
    data: { status: 'failed', phase: 'failed',
      message: 'We did not receive your answer within 24 hours. You can start another production request.',
      completedAt: new Date() },
  })
  return result.count ? await db().motionStudioAgentJob.findUniqueOrThrow({ where: { id: job.id } }) as unknown as T : job
}
function publicJob(job: PublicJob) {
  return { id: job.id, projectId: job.projectId, status: job.status, phase: job.phase,
    parentJobId: job.parentJobId ?? null, revision: job.revision ?? 0,
    progress: job.progress, message: job.message, createdAt: job.createdAt.toISOString(),
    updatedAt: job.updatedAt.toISOString(), waitingStartedAt: job.waitingStartedAt?.toISOString() ?? null,
    completedAt: job.completedAt?.toISOString() ?? null,
    artifacts: artifacts(job.artifacts).filter(a => a.state === 'ready')
      .map(a => ({ id: a.id, kind: a.kind, filename: a.filename, bytes: a.bytes })) }
}

export async function userAgentJob(workspaceId: string, projectId: string, _userId: string) {
  const project = await db().motionStudioProject.findFirst({ where: { workspaceId, id: projectId }, select: { id: true, exportInfo: true } })
  if (!project) throw new MotionStudioError('NOT_FOUND', 'Project not found.', 404)
  const currentLatest = await db().motionStudioAgentJob.findFirst({ where: { workspaceId, projectId }, orderBy: { createdAt: 'desc' } })
  const latest = currentLatest ? await expireStaleQuestion(currentLatest) : null
  const selectedJobId = str(toObject(project.exportInfo).agentJobId, 100)
  const selected = selectedJobId ? await db().motionStudioAgentJob.findFirst({ where: {
    id: selectedJobId, workspaceId, projectId, status: 'complete' } }) : null
  const timedOut = latest?.status === 'failed' && latest.message?.includes('within 24 hours')
  const job = latest && (['queued','dispatching','dispatched','running','needs_input'].includes(latest.status) || timedOut)
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
  if (!pullProducerQueueEnabled() && !coordinatorEnabled() && !agentBridgeConfigured()) throw new MotionStudioError('INTERNAL', 'Grokbot webhook is not configured.', 503)
  if (pullProducerQueueEnabled() && !pullProducerQueueConfigured()) throw new MotionStudioError('INTERNAL', 'Producer queue configuration is incomplete.', 503)
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
    where: { userId, status: { in: ['dispatching', 'dispatched', 'running', 'queued'] } },
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
      status: (pullProducerQueueEnabled() || coordinatorEnabled()) ? 'queued' : 'dispatching', phase: 'dispatch', progress: 0, artifacts: toPrismaJson([]),
      message: (pullProducerQueueEnabled() || coordinatorEnabled()) ? 'Your video is in the production queue.' : 'Submitting assignment to the production bot.' } })
  } catch (err) {
    if ((err as { code?: string })?.code !== 'P2002') throw err
    const duplicate = await db().motionStudioAgentJob.findUnique({ where })
    if (!duplicate) throw err
    return publicJob(duplicate)
  }
  if (pullProducerQueueEnabled()) return publicJob(job)
  if (coordinatorEnabled()) {
    await coordinatePendingJobs(1)
    return publicJob(await db().motionStudioAgentJob.findUniqueOrThrow({ where: { id } }))
  }
  const rawUrl = process.env.GROKBOT_WEBHOOK_URL!
  const webhook = new URL(rawUrl)
  if (webhook.protocol !== 'https:') throw new MotionStudioError('INTERNAL', 'Grokbot webhook requires HTTPS.', 503)
  const settings = toObject(project.settings)
  const creative = sanitizeCreativeBrief(settings.creative)
  const endpoint = baseUrl(request) + '/api/motion-studio/agent/jobs/' + encodeURIComponent(id)
  const payload = {
    version: 1, jobId: id, workspaceId, projectId, action: revisionRequest ? 'revise_video' : 'create_video',
    ...(parent ? { parentJobId: parent.id, revision: parent.revision + 1, threadId: projectId,
      instruction: revisionRequest?.instruction,
      selectedElementIds: revisionRequest?.selectedElementIds ?? [],
      timeRangeMs: revisionRequest?.timeRangeMs ?? null,
      messageHistory: (await db().motionStudioAgentMessage.findMany({ where: { projectId, role: { in: ['customer','answer','agent'] } },
        orderBy: { createdAt: 'desc' }, take: 20 })).reverse().map(m => ({ role: m.role === 'answer' ? 'customer' : m.role, text: m.text })) } : {}),
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
    style: creative.style === 'automatic' ? (str(settings.visualDirection, 80) || 'cinematic') : (creative.style === 'custom' ? creative.customStyle || 'custom' : creative.style),
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
  if (!job) throw new MotionStudioError('UNAUTHENTICATED', 'Expired or invalid token.', 401)
  // Pull-queue worker credentials are valid only while that worker holds an
  // unexpired lease. Paused jobs are released and must be claimed again.
  if (pullProducerQueueEnabled() && !isDone(job.status) && (!job.leaseOwner || !job.leaseExpiresAt ||
      job.leaseExpiresAt.getTime() <= Date.now()))
    throw new MotionStudioError('UNAUTHENTICATED', 'Producer lease expired; claim this job again.', 401)
  const given = sha(id + ':' + token)
  const checkHash = (hex: string | null | undefined) => {
    if (!hex || !/^[a-f0-9]{64}$/.test(hex)) return false
    const expected = Buffer.from(hex, 'hex')
    return expected.length === given.length && timingSafeEqual(given, expected)
  }
  const validPrimary = job.tokenExpiresAt.getTime() > Date.now() && checkHash(job.tokenHash)
  const validStaged = Boolean(job.pendingTokenExpiresAt &&
    job.pendingTokenExpiresAt.getTime() > Date.now() && checkHash(job.pendingTokenHash))
  if (!validPrimary && !validStaged) {
    throw new MotionStudioError('UNAUTHENTICATED', 'Invalid or expired job token.', 401)
  }
  return await expireStaleQuestion(job)
}

/** Durable workspace/project context. Reconstructed for every job; no reliance on a
 * running Grokbot process, local filesystem, or expired pre-signed media links. */
export async function botGetAssignment(id: string, request: Request) {
  const job = await requireBotJob(id, request)
  const project = await db().motionStudioProject.findFirst({
    where: { id: job.projectId, workspaceId: job.workspaceId },
    select: { id: true, workspaceId: true, title: true, brief: true, workflow: true,
      settings: true, story: true, plan: true, narration: true, music: true, qa: true,
      exportInfo: true, timelineVersion: true },
  })
  if (!project) throw new MotionStudioError('NOT_FOUND', 'Project not found.', 404)
  const [projectAssets, priorVersions, recentMessages, recoverableJobs] = await Promise.all([
    db().studioAsset.findMany({ where: { projectId: job.projectId, workspaceId: job.workspaceId } }),
    db().motionStudioAgentJob.findMany({ where: {
      projectId: job.projectId, workspaceId: job.workspaceId, status: 'complete' },
      orderBy: [{ revision: 'desc' }, { createdAt: 'desc' }], take: 20 }),
    db().motionStudioAgentMessage.findMany({ where: {
      projectId: job.projectId, role: { in: ['customer', 'answer', 'agent'] } },
      orderBy: { createdAt: 'desc' }, take: 50 }),
    db().motionStudioAgentJob.findMany({ where: {
      projectId: job.projectId, workspaceId: job.workspaceId,
      id: { not: job.id } },
      orderBy: { createdAt: 'desc' }, take: 15 }),
  ])
  const uploads = projectAssets.length ? await db().clipUpload.findMany({ where: {
    id: { in: projectAssets.map(a => a.uploadId) }, workspaceId: job.workspaceId } }) : []
  const roleByUpload = new Map(projectAssets.map(a => [a.uploadId, toObject(a.provenanceLog).role]))
  const inputs = await Promise.all(uploads.map(async upload => ({
    uploadId: upload.id, filename: upload.filename, mime: upload.mime,
    role: roleByUpload.get(upload.id) || 'source', durableAssetId: upload.id,
    url: await createReadableSignedUrl(upload.key, 1800).catch(() => null),
  })))
  const versions = await Promise.all(priorVersions.map(async previous => ({
    jobId: previous.id, revision: previous.revision, durationMs: previous.durationMs,
    createdAt: previous.createdAt.toISOString(), artifacts: artifacts(previous.artifacts)
      .filter(a => a.state === 'ready').map(a => ({ id: a.id, elementId: a.elementId, trackId: a.trackId,
        kind: a.kind, filename: a.filename, mime: a.mime, bytes: a.bytes })),
    videoUrl: previous.resultKey
      ? await createReadableSignedUrl(previous.resultKey, 1800).catch(() => null) : null,
  })))
  return { ...publicJob(job), workspaceId: job.workspaceId, userId: job.userId,
    title: project.title, prompt: project.brief, settings: project.settings, workflow: project.workflow,
    projectContext: {
      projectId: project.id, workspaceId: project.workspaceId,
      timelineVersion: project.timelineVersion, story: project.story, plan: project.plan,
      narration: project.narration, music: project.music, qa: project.qa,
      exportInfo: { durationMs: toObject(project.exportInfo).durationMs ?? null,
        source: toObject(project.exportInfo).source ?? null,
        agentJobId: toObject(project.exportInfo).agentJobId ?? null },
    },
    checkpoint: job.checkpoint ?? null, inputs, versions,
    resumeAnswer: (await db().motionStudioAgentMessage.findFirst({ where: {
      projectId: job.projectId, jobId: job.id, role: 'answer' }, orderBy: { createdAt: 'desc' } }))?.text || null,
    recoverableCheckpoints: recoverableJobs.filter(previous => previous.checkpoint != null).slice(0, 5).map(previous => ({
      jobId: previous.id, revision: previous.revision, status: previous.status,
      savedAt: previous.updatedAt.toISOString(), checkpoint: previous.checkpoint,
      durableArtifacts: artifacts(previous.artifacts).filter(a => a.state === 'ready')
        .map(a => ({ id: a.id, kind: a.kind, filename: a.filename, mime: a.mime,
          elementId: a.elementId, trackId: a.trackId })),
    })),
    conversation: recentMessages.reverse().map(m => ({ role: m.role === 'answer' ? 'customer' : m.role, text: m.text,
      timestamp: m.createdAt.toISOString(), jobId: m.jobId })),
  }
}

/** Only the active job bearer may read or replace its checkpoint. State survives
 * process restart. All referenced media stays in project storage, not this JSON. */
export async function botGetCheckpoint(id: string, request: Request) {
  const job = await requireBotJob(id, request)
  return { jobId: job.id, workspaceId: job.workspaceId, projectId: job.projectId,
    status: job.status, checkpoint: job.checkpoint ?? null }
}
export async function botSaveCheckpoint(id: string, request: Request, raw: unknown) {
  const job = await requireBotJob(id, request)
  if (isDone(job.status)) throw new MotionStudioError('CONFLICT', 'Cannot change a completed job.', 409)
  let parsed
  try { parsed = validateProducerCheckpoint(raw, job.checkpoint) }
  catch (err) { throw new MotionStudioError('INVALID',
    err instanceof Error ? err.message : 'Invalid checkpoint.', 400) }
  const { revision, state: checkpoint } = parsed
  const current = toObject(job.checkpoint)
  const previousRevision = Number(current.revision) || 0
  if (revision === previousRevision) return { jobId: id, revision, saved: true }
  const state = { revision, state: checkpoint, savedAt: new Date().toISOString() }
  // Conditional update avoids advancing a stale worker after another worker
  // has persisted a newer checkpoint.
  const count = await db().motionStudioAgentJob.updateMany({ where: {
    id, workspaceId: job.workspaceId, projectId: job.projectId,
    updatedAt: job.updatedAt,
    status: { in: ['dispatching', 'dispatched', 'running', 'needs_input'] },
  }, data: { checkpoint: toPrismaJson(state) } })
  if (!count.count) throw new MotionStudioError('CONFLICT', 'Checkpoint changed. Reload before saving.', 409)
  return { jobId: id, revision, saved: true }
}

export async function botProgress(id: string, request: Request, raw: unknown) {
  const job = await requireBotJob(id, request)
  if (isDone(job.status)) throw new MotionStudioError('CONFLICT', 'Job already finished.', 409)
  // The producer may emit late telemetry after asking a question. Never clear needs_input.
  if (!progressMayChangeWaiting(job.status)) return publicJob(job)
  const input = toObject(raw)
  const requestedStage = str(input.stage || input.phase, 60)
  const phase = (CUSTOMER_STAGES as readonly string[]).includes(requestedStage) ? requestedStage : 'scenes'
  const proposed = Number(input.percent ?? input.progress)
  const progress = Number.isFinite(proposed) ? Math.max(job.progress, Math.min(99, Math.round(proposed))) : job.progress
  const message = friendlyMessage(input.message, phase)
  const sceneId = str(input.sceneId, 80)
  const change = await db().motionStudioAgentJob.updateMany({ where: { id, status: { in: ['dispatching','dispatched','running'] } },
    data: { status: 'running', phase, progress, message } })
  if (!change.count) return publicJob(await db().motionStudioAgentJob.findUniqueOrThrow({ where: { id } }))
  const updated = await db().motionStudioAgentJob.findUniqueOrThrow({ where: { id } })
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
    // Every producer artifact also receives a durable Transovo project asset ID.
    // This is necessary for portable manifests to reference assets by ID, never by path.
    await db().studioAsset.upsert({
      where: { id: item.id },
      create: { id: item.id, projectId: job.projectId, workspaceId: job.workspaceId,
        uploadId: item.id, kind: item.kind, filename: item.filename, status: 'ready' },
      update: { status: 'ready' },
    })
    await db().motionStudioAgentJob.update({ where: { id }, data: { artifacts: toPrismaJson(all) } })
    return { uploadId: item.id, status: 'ready', bytes: size }
  }
  throw new MotionStudioError('INVALID', 'Expected prepare or commit.', 400)
}

/** Queue exactly one follow-up revision after a completed job. Its stable key keeps
 * repeated completion callbacks from starting duplicate productions. */
async function dispatchQueuedAfterFinish(job: { id: string; workspaceId: string; userId: string; projectId: string }, request: Request) {
  const queued = await db().motionStudioAgentMessage.findMany({ where: {
    projectId: job.projectId, role: 'queued_edit' },
    orderBy: { createdAt: 'asc' }, take: 20 })
  if (!queued.length) return
  const instruction = queued.map((m, i) => `${i + 1}. ${m.text}`).join('\n').slice(0, 2500)
  try {
    const result = await dispatchAgentJob(job.workspaceId, job.userId, job.projectId,
      'queued-after-' + job.id, request, { instruction })
    if (!['dispatch_failed','failed','cancelled'].includes(result.status)) {
      await db().motionStudioAgentMessage.updateMany({ where: {
        projectId: job.projectId, id: { in: queued.map(item => item.id) }, role: 'queued_edit' },
        data: { role: 'queued_sent' } })
      await db().motionStudioAgentMessage.create({ data: {
        id: 'msmsg_' + randomUUID(), projectId: job.projectId, jobId: result.id, role: 'agent',
        text: 'The previous video is complete, and I’ve submitted your queued changes as the next version.' } })
    }
  } catch (err) {
    console.warn('[motion-studio:chat] queued_dispatch_deferred', { projectId: job.projectId,
      jobId: job.id, error: err instanceof Error ? err.name : typeof err })
  }
}

export async function botFinish(id: string, request: Request, raw: unknown) {
  const job = await requireBotJob(id, request)
  if (job.status === 'complete') {
    await dispatchQueuedAfterFinish(job, request)
    return publicJob(job)
  }
  if (isDone(job.status)) throw new MotionStudioError('CONFLICT', 'Job already finished.', 409)
  const input = toObject(raw)
  if (input.status === 'failed') {
    const message = "We hit a snag finishing your video. Please try again."
    const failed = await db().motionStudioAgentJob.update({ where: { id },
      data: { status: 'failed', phase: 'failed', message, completedAt: new Date() } })
    // Do not discard queued creative requests. A later successful production
    // will collect these from the project's persistent queued_edit messages.
    await db().motionStudioAgentMessage.create({ data: {
      id: 'msmsg_' + randomUUID(), projectId: job.projectId, jobId: id, role: 'agent',
      text: 'Production stopped, but your requested follow-up edits are saved in this project.' } })
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
  if (pullProducerQueueEnabled()) await releaseProducerLease(id)
  await dispatchQueuedAfterFinish(job, request)
  return publicJob(completed)
}


/** Workspace-scoped persisted customer conversation, independent of production-run retries. */
export async function agentThread(workspaceId: string, projectId: string) {
  const project = await db().motionStudioProject.findFirst({ where: { id: projectId, workspaceId }, select: { id: true, exportInfo: true } })
  if (!project) throw new MotionStudioError('NOT_FOUND', 'Project not found.', 404)
  const [messages, jobs] = await Promise.all([
    db().motionStudioAgentMessage.findMany({ where: { projectId, role: { in: ['customer','answer','agent'] } }, orderBy: { createdAt: 'asc' }, take: 250 }),
    db().motionStudioAgentJob.findMany({ where: { workspaceId, projectId, status: 'complete' },
      select: { id: true, revision: true, durationMs: true, createdAt: true }, orderBy: { revision: 'asc' } }),
  ])
  return { threadId: projectId, activeJobId: str(toObject(project.exportInfo).agentJobId, 100) || jobs.at(-1)?.id || null, messages: messages.map(m=>({ id:m.id,role:m.role === 'answer' ? 'customer' : m.role,text:m.text,
    timestamp:m.createdAt.toISOString(),jobId:m.jobId })),
    versions: jobs.map(j=>({ jobId:j.id,revision:j.revision,durationMs:j.durationMs,createdAt:j.createdAt.toISOString() })) }
}

/** The only customer-facing message entrypoint: natural-language assistant first, production
 * jobs only for confirmed, actionable edits. No additional login gate in testing mode. */
export async function submitAgentRevision(workspaceId: string, userId: string, projectId: string, request: Request, raw: unknown) {
  const input = toObject(raw)
  const instruction = str(input.instruction || input.text, 2500)
  if (instruction.length < 2) throw new MotionStudioError('INVALID', 'Tell Transovo what you need.', 400)
  const selectedElementIds = Array.isArray(input.selectedElementIds)
    ? input.selectedElementIds.slice(0,20).map(v=>str(v,80)).filter(Boolean) : []
  const times = Array.isArray(input.timeRangeMs) ? input.timeRangeMs.map(Number) : []
  const timeRangeMs: [number,number] | undefined = times.length === 2 && times.every(Number.isSafeInteger) &&
    times[0] >= 0 && times[1] > times[0] ? [times[0],times[1]] : undefined
  const project = await db().motionStudioProject.findFirst({ where: { id: projectId, workspaceId },
    select: { id: true, title: true, status: true, settings: true } })
  if (!project) throw new MotionStudioError('NOT_FOUND', 'Project not found.', 404)

  const key = str(request.headers.get('Idempotency-Key'),120) || 'message-' + randomUUID()
  const messageId = 'msmsg_' + createHash('sha256').update(projectId + ':' + key).digest('hex').slice(0, 32)
  const confirmationId = 'msmsg_ack_' + createHash('sha256').update(projectId + ':' + key).digest('hex').slice(0, 32)
  const existingMessage = await db().motionStudioAgentMessage.findFirst({ where: { projectId, id: messageId } })
  const recent = await db().motionStudioAgentMessage.findMany({ where: { projectId },
    orderBy: { createdAt: 'desc' }, take: 12 })
  const rawLatest = await db().motionStudioAgentJob.findFirst({
    where: { projectId, workspaceId }, orderBy: { createdAt: 'desc' } })
  const latest = rawLatest ? await expireStaleQuestion(rawLatest) : null
  const selectedStatus = latest?.status || project.status
  const pending = latest && !isDone(latest.status)
  const knownQuestion = isStatusQuestion(instruction)
  // An answer is persisted BEFORE the webhook. If a later DB write fails, a retry
  // replays the same stable key to the producer and repairs the local confirmation.
  const answerJob = input.answerInput === true && !knownQuestion
    ? existingMessage?.jobId ? await db().motionStudioAgentJob.findFirst({
        where: { workspaceId, projectId, id: existingMessage.jobId } }) : latest?.status === 'needs_input' ? latest : null
    : null
  if (answerJob && !isDone(answerJob.status)) {
    if (existingMessage && existingMessage.text !== instruction)
      throw new MotionStudioError('CONFLICT', 'An answer retry must use the original message.', 409)
    if (!existingMessage) await db().motionStudioAgentMessage.create({ data: {
      id: messageId, projectId, jobId: answerJob.id, role: 'answer', text: instruction } })
    const confirmed = await db().motionStudioAgentMessage.findFirst({ where: { projectId, id: confirmationId } })
    if (!confirmed) {
      if (pullProducerQueueEnabled() || coordinatorEnabled()) {
        await db().motionStudioAgentJob.updateMany({ where: {
          id: answerJob.id, workspaceId, projectId, status: 'needs_input' }, data: {
          status: 'queued', phase: 'accepted', waitingStartedAt: null, leaseAttempts: 0, message: 'Your answer was received. Production will resume on an available worker.',
          leaseOwner: null, leaseIdHash: null, leaseExpiresAt: null,
        } })
        await db().motionStudioAgentMessage.upsert({ where: { id: confirmationId },
          create: { id: confirmationId, projectId, jobId: answerJob.id, role: 'agent',
            text: 'Thanks, your answer was saved. Production will resume from its saved checkpoint.' }, update: {} })
        if (coordinatorEnabled()) await coordinatePendingJobs(1)
        return { job: null, intent: 'conversation' }
      }
      if (!agentBridgeConfigured()) throw new MotionStudioError('INTERNAL', 'Video production is not connected.', 503)
      // Only one distinct answer may be delivered for a given job at once.
      // The same idempotency key may retry after a partial write failure.
      const claimed = await db().motionStudioAgentJob.updateMany({ where: {
        id: answerJob.id, workspaceId, projectId,
        status: existingMessage ? { in: ['needs_input','running'] } : 'needs_input',
        OR: [
          { answerInFlightKey: null },
          { answerInFlightUntil: { lt: new Date() } },
          { answerInFlightKey: key },
        ],
      }, data: { answerInFlightKey: key, answerInFlightUntil: new Date(Date.now()+60_000) } })
      if (!claimed.count) throw new MotionStudioError('CONFLICT',
        'Another answer is being delivered for this video. Please retry.', 409)
      // Deterministic fresh access for the existing job: an identical retry
      // derives the same token even if webhook acceptance preceded a DB failure.
      const resumeSecret = process.env.MOTION_STUDIO_JOB_TOKEN_SECRET || ''
      if (resumeSecret.length < 32 || resumeSecret === process.env.GROKBOT_WEBHOOK_KEY)
        throw new MotionStudioError('INTERNAL', 'Configure a separate producer token secret (32+ characters).', 503)
      const resumedToken = createHmac('sha256', resumeSecret)
        .update('motion-studio-answer:v2:' + answerJob.id + ':' + key).digest('base64url')
      const resumedExpires = new Date(Date.now() + 36 * 3600_000)
      await db().motionStudioAgentJob.updateMany({ where: {
        id: answerJob.id, workspaceId, projectId,
        status: { in: ['needs_input','running'] } }, data: {
        pendingTokenHash: sha(answerJob.id + ':' + resumedToken).toString('hex'),
        pendingTokenExpiresAt: resumedExpires,
      } })
      let accepted = false
      try {
        const response = await fetch(process.env.GROKBOT_WEBHOOK_URL!, {
          method: 'POST', redirect: 'error', cache: 'no-store',
          headers: { Authorization: 'Bearer ' + process.env.GROKBOT_WEBHOOK_KEY!, 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'answer_input', jobId: answerJob.id, workspaceId, projectId,
            text: instruction, idempotencyKey: key,
            jobUrl: baseUrl(request) + '/api/motion-studio/agent/jobs/' + encodeURIComponent(answerJob.id),
            jobToken: resumedToken, tokenExpiresAt: resumedExpires.toISOString() }),
          signal: AbortSignal.timeout(15_000),
        })
        accepted = response.ok
      } catch { /* The saved answer survives, allowing an identical-key retry. */ }
      if (!accepted) {
        await db().motionStudioAgentJob.updateMany({ where: {
          id: answerJob.id, workspaceId, projectId, pendingTokenHash: sha(answerJob.id + ':' + resumedToken).toString('hex'),
        }, data: { pendingTokenHash: null, pendingTokenExpiresAt: null,
          answerInFlightKey: null, answerInFlightUntil: null } })
        throw new MotionStudioError('CONFLICT', 'Could not deliver your answer. Please retry.', 503)
      }
      await db().motionStudioAgentJob.updateMany({ where: {
        workspaceId, projectId, id: answerJob.id, status: { in: ['needs_input','running'] },
        pendingTokenHash: sha(answerJob.id + ':' + resumedToken).toString('hex') }, data: {
        tokenHash: sha(answerJob.id + ':' + resumedToken).toString('hex'), tokenExpiresAt: resumedExpires,
        pendingTokenHash: null, pendingTokenExpiresAt: null,
        answerInFlightKey: null, answerInFlightUntil: null,
        status: 'running', waitingStartedAt: null, leaseAttempts: 0, message: "We're continuing with your direction…" } })
      await db().motionStudioAgentMessage.upsert({ where: { id: confirmationId },
        create: { id: confirmationId, projectId, jobId: answerJob.id, role: 'agent',
          text: 'Thanks, I’ve passed your answer to production. I’ll update you as it progresses.' },
        update: {} })
    }
    return { job: null, intent: 'conversation' }
  }
  if (existingMessage) {
    const previousJob = existingMessage.jobId ? await db().motionStudioAgentJob.findFirst({
      where: { workspaceId, projectId, id: existingMessage.jobId } }) : null
    return { job: previousJob ? publicJob(previousJob) : null, intent: previousJob ? 'edit' : 'conversation' }
  }
  if (input.answerInput === true && latest?.status !== 'needs_input') {
    throw new MotionStudioError('CONFLICT', 'That production is no longer waiting for an answer.', 409)
  }
  const decision = knownQuestion
    ? { intent: 'question' as const, reply: statusReply(selectedStatus, latest?.phase || project.status, latest?.progress || 0), instruction: '' }
    : await interpretCustomerMessage({
        message: instruction, title: project.title, status: selectedStatus, phase: latest?.phase || '',
        currentTimeMs: timeRangeMs?.[0], selectedElementIds, brand: toObject(project.settings).creative,
        recent: recent.reverse().map(m => ({ role: m.role === 'answer' ? 'customer' : m.role, text: m.text })),
      })
  // While rendering, requests are conversational only; do not create overlapping revision jobs.
  let response = publicAssistantText(decision.reply) || 'Could you give me a little more detail?'
  let job: Awaited<ReturnType<typeof dispatchAgentJob>> | null = null
  const wantsEdit = decision.intent === 'edit'
  if (wantsEdit && pending) {
    // Never launch overlapping generations. Durable queue is drained on the
    // current job's successful completion, not while it waits for a customer.
    await db().motionStudioAgentMessage.upsert({ where: { id: 'msmsg_queue_' + messageId.slice(6) },
      create: { id: 'msmsg_queue_' + messageId.slice(6), projectId, jobId: latest.id,
        role: 'queued_edit', text: (decision.instruction || instruction).slice(0, 2500) }, update: {} })
    // The producer may complete between our original status check and queueing.
    const currentJob = await db().motionStudioAgentJob.findUnique({ where: { id: latest.id } })
    if (currentJob?.status === 'complete') await dispatchQueuedAfterFinish(currentJob, request)
    response = latest.status === 'needs_input'
      ? 'I’ve queued that change for the next version. Please also answer the production question so the current video can finish.'
      : 'I’ve queued that change for the next version. I won’t interrupt the video that is currently processing.'
  } else if (wantsEdit && !latest?.resultKey && !await db().motionStudioAgentJob.findFirst({
    where: { projectId, workspaceId, status: 'complete' }, select: { id: true } })) {
    response = 'I understand the change. Once your first video is ready, I can submit this as a revision.'
  } else if (wantsEdit) {
    // Dispatch before recording the assistant success reply. If dispatch fails we tell the truth.
    try {
      job = await dispatchAgentJob(workspaceId, userId, projectId, key, request, {
        instruction: decision.instruction || instruction, selectedElementIds, timeRangeMs,
      })
      response = ['dispatch_failed','failed'].includes(job.status)
        ? 'I understood the edit, but the production system could not accept it. Please try again.'
        : 'I’ve sent your requested changes to production. I’ll show progress here and keep the previous version available.'
    } catch {
      response = 'I understood your edit, but could not submit it yet. Please try again.'
    }
  }
  // Store the visible customer-facing conversation in the existing project thread.
  await db().motionStudioAgentMessage.create({ data: { id: messageId,
    projectId, role: 'customer', text: instruction, jobId: job?.id } })
  await db().motionStudioAgentMessage.create({ data: { id: 'msmsg_' + randomUUID(),
    projectId, role: 'agent', text: response, jobId: job?.id } })
  return { job, intent: wantsEdit && job ? 'edit' : 'conversation' }
}

export async function botPostMessage(id: string, request: Request, raw: unknown) {
  const job = await requireBotJob(id,request)
  if (isDone(job.status)) throw new MotionStudioError('CONFLICT', 'Cannot ask a question on a finished job.', 409)
  const input = toObject(raw)
  const text = input.needsInput === true ? customerQuestion(input.text) : friendlyMessage(input.text, 'review')
  if (!text) throw new MotionStudioError('INVALID','Message required.',400)
  const item = await db().$transaction(async tx => {
    if (input.needsInput === true && !isDone(job.status)) {
      await tx.motionStudioAgentJob.updateMany({ where: {
        id, status: { in: ['dispatching','dispatched','running','needs_input'] } }, data: {
        status: 'needs_input', waitingStartedAt: job.status === 'needs_input' && job.waitingStartedAt ? job.waitingStartedAt : new Date(),
        tokenExpiresAt: new Date(Date.now() + 36*3600_000),
        ...(pullProducerQueueEnabled() ? { leaseOwner: null, leaseIdHash: null, leaseExpiresAt: null } : {}),
        message: "We're waiting for your direction…" } })
    }
    return tx.motionStudioAgentMessage.create({ data: { id:'msmsg_'+randomUUID(),
      projectId:job.projectId,jobId:id,role:'agent',text } })
  })
  return { id:item.id, role:'agent',text:item.text,timestamp:item.createdAt.toISOString() }
}

/** An active producer can recover *ready* artifacts from an earlier job of the
 * same project and workspace, including incomplete attempts. URLs are minted
 * on demand; neither stale tokens nor foreign project files can be reused. */
export async function botRecoveryArtifacts(id: string, request: Request, sourceJobId: string) {
  const job = await requireBotJob(id, request)
  if (!/^msaj_[a-f0-9-]{36}$/.test(sourceJobId))
    throw new MotionStudioError('INVALID', 'Valid source job required.', 400)
  const source = await db().motionStudioAgentJob.findFirst({ where: {
    id: sourceJobId, projectId: job.projectId, workspaceId: job.workspaceId,
  } })
  if (!source) throw new MotionStudioError('NOT_FOUND', 'Saved production artifacts not found.', 404)
  const ready = artifacts(source.artifacts).filter(a => a.state === 'ready').slice(0, 300)
  return { workspaceId: job.workspaceId, projectId: job.projectId,
    sourceJobId, status: source.status,
    checkpoint: source.checkpoint ?? null,
    artifacts: await Promise.all(ready.map(async a => ({
      id: a.id, elementId: a.elementId, trackId: a.trackId, kind: a.kind,
      filename: a.filename, mime: a.mime, bytes: a.bytes,
      url: await createReadableSignedUrl(a.key, 900).catch(() => null),
    }))),
  }
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
