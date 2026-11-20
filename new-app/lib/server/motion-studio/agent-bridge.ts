import 'server-only'
import { createHash, createHmac, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto'
import { getPrisma } from '@/lib/server/db'
import { coordinatorEnabled, coordinatePendingJobs, renewCreativeLease } from '@/lib/server/motion-studio/coordinator'
import { portableAssetSession } from '@/lib/server/motion-studio/portable-assets'
import { createReadableSignedUrl, getClipStorage, storageDriverName } from '@/lib/storage'
import { toPrismaJson } from '@/lib/server/clips/prisma-json'
import { MotionStudioError } from '@/lib/server/motion-studio/errors'
import { interpretCustomerMessage } from '@/lib/server/motion-studio/chat-assistant'
import { isStatusQuestion, statusReply, publicAssistantText } from '@/lib/motion-studio/chat-intent'
import { customerQuestion, progressMayChangeWaiting, waitingExpired, CUSTOMER_WAIT_MS } from '@/lib/motion-studio/waiting-contract'
import { sanitizeCreativeBrief, directorCategoryGuidance } from '@/lib/motion-studio/creative-options'
import { validateProducerCheckpoint } from '@/lib/motion-studio/checkpoint-contract'
import { validatePortableManifest } from '@/lib/motion-studio/portable-contract'
import { pullProducerQueueEnabled, pullProducerQueueConfigured, releaseProducerLease } from '@/lib/server/motion-studio/producer-queue'

const db = () => getPrisma()
const toObject = (x: unknown): Record<string, unknown> => x && typeof x === 'object' && !Array.isArray(x) ? x as Record<string, unknown> : {}
const str = (x: unknown, max = 4000): string => typeof x === 'string' ? x.trim().slice(0, max) : ''
const sha = (x: string): Buffer => createHash('sha256').update(x).digest()
const MAX_FILE = 2_000_000_000
type Artifact = { id: string; key: string; kind: string; filename: string; mime: string; bytes: number; state: 'pending' | 'ready'; s3UploadId?: string; elementId?: string; trackId?: string; sha256?: string }
const artifacts = (raw: unknown): Artifact[] => Array.isArray(raw) ? raw as Artifact[] : []
const isDone = (status: string) => ['complete', 'failed', 'dispatch_failed', 'cancelled'].includes(status)
const CUSTOMER_STAGES = ['research','story','voice','design','scenes','review','fixing','rendering','delivering','complete'] as const
const DEFAULT_STAGE_MESSAGES: Record<string, string> = { research: "We're finding the best photos and clips…", story: "We're writing your story…", design: "We're designing the visual look…", voice: "We're recording narration…", scenes: "We're building your scenes…", review: "We're reviewing the cut…", fixing: "We're polishing a few details…", rendering: "We're rendering your final video…", delivering: "We're adding the video to your timeline…", complete: "Your video is ready." }
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
// An optional clean picture track is scoped to the same finished assignment.
function editorPicture(raw: unknown, master: Artifact) {
  return artifacts(raw).find(a => a.state==='ready' && a.filename==='editor-base.mp4' &&
    a.kind==='video' && a.mime==='video/mp4') ?? master
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
  // exportInfo.masterKey is rewritten by every completion, including a
  // no-AI render-project re-render, so it is always the newest committed MP4.
  const latestMaster = str(toObject(project.exportInfo).masterKey, 600)
  const activeVideoKey = (job.status !== 'complete' && job.resultKey) || (job.status === 'complete' || job.parentJobId ? latestMaster : '') ||
    job.resultKey || previousVideo?.resultKey
  const videoUrl = activeVideoKey ? await createReadableSignedUrl(activeVideoKey, 3600).catch(() => null) : null
  // Polled by every open project page: filter to this job in SQL and read only the
  // columns the timeline needs (newest 200), instead of 500 full rows per tick.
  const events = (await db().studioActivityEvent.findMany({
    where: { projectId, kind: 'agent_progress', data: { path: ['jobId'], equals: job.id } },
    orderBy: { id: 'desc' }, take: 200,
    select: { id: true, stage: true, message: true, data: true, createdAt: true },
  })).reverse()
  const editable = await db().motionStudioPortableVersion.findFirst({
    where:{workspaceId,projectId,sourceJobId:job.id,status:'committed'}, select:{id:true},
  })
  return { ...publicJob(job), delivery:toObject(project.exportInfo).delivery||'legacy', editableReady:Boolean(editable),
    masterReadyAt:toObject(project.exportInfo).masterReadyAt||null, masterReady:Boolean(job.resultKey)||
      (toObject(project.exportInfo).delivery==='live'&&Boolean(editable)), phase: CUSTOMER_STAGES.includes(job.phase as typeof CUSTOMER_STAGES[number]) ? job.phase : 'research', message: friendlyMessage(job.message, job.phase), videoUrl,
    stages: CUSTOMER_STAGES, events: events.filter(e => toObject(e.data).jobId === job.id).map(e => ({ id: e.id, stage: e.stage, message: e.message, timestamp: e.createdAt.toISOString(), sceneId: str(toObject(e.data).sceneId, 80) || undefined, percent: toObject(e.data).percent })) }
}

/**
 * A manually edited timeline is a valid revision base even if no previous
 * Grokbot video job has finished. Source files and edits are workspace scoped;
 * URLs are short-lived and never embedded in durable job state.
 */
async function manualEditorBase(workspaceId:string,projectId:string){
  const project=await db().motionStudioProject.findFirst({
    where:{workspaceId,id:projectId},
    select:{clipId:true,clipProjectId:true},
  })
  if(!project?.clipId||!project.clipProjectId)return null
  const [clip,clipProject]=await Promise.all([
    db().clip.findFirst({where:{id:project.clipId,workspaceId},
      select:{id:true,edits:true,startMs:true,endMs:true}}),
    db().clipProject.findFirst({where:{id:project.clipProjectId,workspaceId},
      select:{id:true,uploadId:true,status:true,rangeEndMs:true}}),
  ])
  if(!clip||!clipProject?.uploadId||clipProject.status!=='READY')return null
  const upload=await db().clipUpload.findFirst({
    where:{id:clipProject.uploadId,workspaceId},
    select:{id:true,key:true,status:true,mime:true,durationMs:true},
  })
  if(!upload||!['READY','COMPLETE'].includes(upload.status)||!upload.mime.startsWith('video/'))
    return null
  const url=await createReadableSignedUrl(upload.key,1800).catch(()=>null)
  if(!url)return null
  return {
    clipId:clip.id,clipProjectId:clipProject.id,sourceUploadId:upload.id,
    sourceUrl:url,sourceMime:upload.mime,
    durationMs:Number(upload.durationMs||clipProject.rangeEndMs||clip.endMs),
    edits:clip.edits,
  }
}

export type RevisionRequest = { instruction: string; selectedElementIds?: string[]; timeRangeMs?: [number, number] }
export async function dispatchAgentJob(workspaceId: string, userId: string, projectId: string, key: string | null, request: Request, revisionRequest?: RevisionRequest) {
  if (pullProducerQueueEnabled() && coordinatorEnabled())
    throw new MotionStudioError('INTERNAL', 'Choose either pull queue or webhook coordinator, not both.', 503)
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
  const manualBase = revisionRequest ? await manualEditorBase(workspaceId,projectId) : null
  if (revisionRequest && !parent && !manualBase)
    throw new MotionStudioError('CONFLICT', 'A finished video or a playable manual timeline is required before requesting edits.', 409)
  const idempotencyKey = str(key, 120) || 'initial-production'
  const where = { projectId_idempotencyKey: { projectId, idempotencyKey } }
  const previous = await db().motionStudioAgentJob.findUnique({ where })
  if (previous) return publicJob(previous)
  // Internal/no-login testing has no per-account daily or concurrent creation
  // quota. Idempotency keys and the durable producer/worker scheduler still
  // prevent duplicate dispatches and control physical render concurrency.
  // Introduce tenant usage quotas only when billing and tenant auth are live.
  const id = 'msaj_' + randomUUID()
  const token = randomBytes(32).toString('base64url')
  const tokenHash = sha(id + ':' + token).toString('hex')
  let job
  try {
    job = await db().motionStudioAgentJob.create({ data: { id, projectId, workspaceId, userId,
      idempotencyKey, parentJobId: parent?.id ?? null,
      revision: revisionRequest ? (parent?.revision ?? 0) + 1 : 0,
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
    delivery:{mode:'live'},
    ...(revisionRequest ? {
      ...(parent ? {parentJobId:parent.id} : {}),
      revision:(parent?.revision ?? 0)+1,threadId:projectId,
      instruction:revisionRequest.instruction,
      selectedElementIds:revisionRequest.selectedElementIds??[],
      timeRangeMs:revisionRequest.timeRangeMs??null,
      ...(manualBase?{manualTimeline:manualBase}:{}),
      messageHistory:(await db().motionStudioAgentMessage.findMany({
        where:{projectId,role:{in:['customer','answer','agent']}},
        orderBy:{createdAt:'desc'},take:20,
      })).reverse().map(m=>({role:m.role==='answer'?'customer':m.role,text:m.text})),
    } : {}),
    title: project.title, prompt: project.brief,
    videoType: creative.videoType,
    categoryGuidance: directorCategoryGuidance(creative.videoType),
    creative: { ...creative, brand: creative.brandMode === 'none' ? undefined : creative.brand },
    // Original prompt always remains intact; creative guidance is separate, never a scene template.
    durationSeconds: Number.isSafeInteger(Number(settings.durationSeconds)) &&
      Number(settings.durationSeconds) >= 5 && Number(settings.durationSeconds) <= 2147483
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
  if ((pullProducerQueueEnabled() || coordinatorEnabled()) && !isDone(job.status) && (!job.leaseOwner || !job.leaseExpiresAt ||
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
  // An authenticated job-token call proves the worker is still producing:
  // renew its lease so the sweep never re-dispatches a live creative job.
  if (coordinatorEnabled() && job.leaseOwner && !isDone(job.status))
    await renewCreativeLease(job.id, job.leaseOwner, job.leaseExpiresAt).catch(() => undefined)
  // A detached, job-token-authenticated Modal worker needs lease survival even
  // under pull-queue mode. Limit renewal to the current, unexpired owner;
  // never permit a stale token to reclaim an expired or reassigned lease.
  if (pullProducerQueueEnabled() && job.leaseOwner && !isDone(job.status)) {
    await db().motionStudioAgentJob.updateMany({
      where:{id:job.id,leaseOwner:job.leaseOwner,
        leaseExpiresAt:{gt:new Date()},
        status:{in:['queued','dispatched','running','dispatching']}},
      data:{leaseExpiresAt:new Date(Date.now()+5*60_000)},
    })
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
  const latestSource = await db().motionStudioPortableVersion.findFirst({
    where:{projectId:job.projectId,workspaceId:job.workspaceId,status:'committed'},
    orderBy:{revision:'desc'},
  })
  const portableProject = latestSource ? {
    id:latestSource.id,revision:latestSource.revision,
    parentId:latestSource.parentId,manifest:latestSource.manifest,
    theme:latestSource.theme,overrides:latestSource.overrides,
    assetSession:await portableAssetSession(job.workspaceId,job.projectId,latestSource.id),
    refreshUrl:baseUrl(request)+'/api/motion-studio/agent/jobs/'+encodeURIComponent(id)+
      '/portable?versionId='+encodeURIComponent(latestSource.id),
  }:null
  return { ...publicJob(job), workspaceId: job.workspaceId, userId: job.userId,
    portableProject,
    delivery:{mode:'live'},
    productionInstructions: {
      editableTimeline: 'Render and approve the completed master MP4 first so the customer can watch while the job remains open. Then deliver transovo.live-project/1 with registered original scene bundles, footage layers, editable text and caption tracks, grouped audio stems and active-duration effects. Retain source handles and edits.',
      review: 'Inspect the first, busiest and last frames and adjacent cuts in the approved master and confirm the editable scene structure reproduces them.',
      progress: 'Post research, story, voice, design, scenes, review, fixing, rendering and delivering on actual stage transitions. Send completed/total files during publishing.',
      delivery: 'After approval, upload and approveMaster the MP4 without completing the job. Upload the immutable editable project in the background, publish the producer document and transovo.live-project/1 with registered assets, then complete with delivery:live and portableVersionId. Keep the already-approved MP4 as the original preview.',
      heartbeat: 'The detached editable-delivery worker sends /checkpoint while uploading and retrying. Resume unfinished uploads before starting the next job. The job-token lease must remain valid; after an expired producer lease, obtain a new assignment rather than reusing an expired token.',
    },
    manualTimeline: await manualEditorBase(job.workspaceId,job.projectId),
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

// Storage I/O happens outside this transaction. Merge only this receipt under the
// row lock, so concurrent completions cannot overwrite another upload's receipt.
async function storeArtifact(owner:{id:string;tokenHash:string}, incoming:Artifact | Artifact[]) {
  await db().$transaction(async tx => {
    await tx.$queryRaw`SELECT "id" FROM "MotionStudioAgentJob" WHERE "id" = ${owner.id} FOR UPDATE`
    const current=await tx.motionStudioAgentJob.findUniqueOrThrow({where:{id:owner.id}})
    if (isDone(current.status) || current.tokenHash !== owner.tokenHash)
      throw new MotionStudioError('CONFLICT','Upload assignment changed.',409)
    const list=artifacts(current.artifacts)
    const items=Array.isArray(incoming)?incoming:[incoming]
    for (const item of items) {
      const index=list.findIndex(a=>a.id===item.id)
      if (index<0 && list.length>=10000) throw new MotionStudioError('INVALID','Too many artifacts.',400)
      if (index<0) list.push(item)
      else list[index]=item
    }
    await tx.motionStudioAgentJob.update({where:{id:owner.id},data:{artifacts:toPrismaJson(list)}})
  })
}

export async function botAssets(id: string, request: Request, raw: unknown) {
  const job = await requireBotJob(id, request)
  if (isDone(job.status)) throw new MotionStudioError('CONFLICT', 'Job already finished.', 409)
  const input = toObject(raw)
  const action = str(input.action, 20)
  const all = artifacts(job.artifacts)
  if (action === 'approveMaster') {
    const isMaster=(a:Artifact)=>a.id===input.uploadId && a.filename!=='editor-base.mp4' && a.state==='ready' && a.mime==='video/mp4' && a.kind==='video'
    let master=all.find(isMaster)
    if (!master && typeof input.sourceJobId==='string') {
      const source=await db().motionStudioAgentJob.findFirst({where:{id:input.sourceJobId,
        projectId:job.projectId,workspaceId:job.workspaceId},select:{artifacts:true}})
      master=artifacts(source?.artifacts).find(isMaster)
      if (master) await storeArtifact(job,master)
    }
    if (!master) throw new MotionStudioError('INVALID','A committed MP4 master is required.',400)
    const updated=await db().motionStudioAgentJob.updateMany({where:{id,tokenHash:job.tokenHash,
      status:{in:['dispatched','dispatching','running']}},data:{resultKey:master.key}})
    if (!updated.count) throw new MotionStudioError('CONFLICT','Upload assignment changed.',409)
    // The approved MP4 is independently viewable before portable scene
    // publication. Do not close the active job or mark editor ready here.
    await db().$transaction(async tx=>{
      const project=await tx.motionStudioProject.findUniqueOrThrow({
        where:{id:job.projectId},select:{exportInfo:true,clipProjectId:true},
      })
      await tx.motionStudioProject.update({where:{id:job.projectId},data:{
        exportInfo:toPrismaJson({...toObject(project.exportInfo),
          masterKey:master.key,smallKey:master.key,storageDriver:storageDriverName(),
          source:'transovo_agent',agentJobId:id,delivery:'live',
          masterReadyAt:new Date().toISOString(),editableReady:false}),
      }})
      if(project.clipProjectId){
        const clip=await tx.clipProject.findFirst({
          where:{id:project.clipProjectId,workspaceId:job.workspaceId},
          select:{uploadId:true},
        })
        if(clip?.uploadId)await tx.clipUpload.updateMany({
          where:{id:clip.uploadId,workspaceId:job.workspaceId},
          data:{key:master.key,bytes:BigInt(master.bytes),mime:'video/mp4',
            filename:master.filename,status:'READY',storageDriver:storageDriverName()},
        })
      }
    })
    await db().studioActivityEvent.create({data:{projectId:job.projectId,
      stage:'render',kind:'master_ready',message:'Video ready to watch',
      data:toPrismaJson({jobId:id,filename:master.filename,bytes:master.bytes})}})
    return {videoReady:true,editableReady:false}
  }
  if (action === 'reuse') {
    if (typeof input.sourceJobId!=='string' || !Array.isArray(input.ids) || input.ids.length>10000)
      throw new MotionStudioError('INVALID','Invalid recovery receipts.',400)
    const source=await db().motionStudioAgentJob.findFirst({where:{id:input.sourceJobId,
      workspaceId:job.workspaceId,projectId:job.projectId},select:{artifacts:true}})
    const wanted=new Set(input.ids)
    const borrowed=artifacts(source?.artifacts).filter(a=>wanted.has(a.id) && a.state==='ready' && a.sha256)
    if (borrowed.length!==wanted.size) throw new MotionStudioError('CONFLICT','Incomplete recovery receipts.',409)
    await storeArtifact(job,borrowed)
    return {reused:borrowed.length}
  }
  if (action === 'receipts') {
    const sourceId = str(input.sourceJobId,100)
    const source = sourceId && sourceId !== job.id
      ? await db().motionStudioAgentJob.findFirst({where:{id:sourceId,workspaceId:job.workspaceId,
          projectId:job.projectId},select:{artifacts:true}}) : null
    const currentIds=new Set(all.map(a=>a.id))
    return {receipts:[...artifacts(source?.artifacts),...all]
      .filter(a=>a.state==='ready' && a.sha256)
      .map(({id,sha256,kind,filename,bytes,mime})=>({id,sha256,kind,filename,bytes,mime,currentJob:currentIds.has(id)}))}
  }
  if (action === 'prepare') {
    const filename = str(input.filename, 150).replace(/[^a-zA-Z0-9._-]/g, '_')
    const kind = str(input.kind, 30), mime = str(input.mime, 80), bytes = Number(input.bytes)
    const elementId = str(input.elementId, 100), trackId = str(input.trackId, 100)
    const checksum = str(input.sha256, 64).toLowerCase()
    const nativeKind = ['font','image','bundle'].includes(kind)
    const allowedMime = [
      'video/mp4','video/webm','video/quicktime','application/json','image/png',
      'image/jpeg','image/webp','image/svg+xml','audio/mpeg','audio/wav',
      'audio/x-wav','audio/mp4','text/plain','text/vtt','application/x-subrip','application/zip',
      'font/ttf','font/otf','font/woff','font/woff2',
      'application/octet-stream','application/wasm','application/javascript','text/javascript','text/css',
    ]
    if (!filename || !['video', 'project', 'media', 'audio', 'source','font','image','bundle'].includes(kind)
      || !allowedMime.includes(mime)
      || (mime==='application/octet-stream' && (kind!=='source' || !checksum || bytes>16*1024*1024 || !filename.endsWith('.frames')))
      || (nativeKind && (!/^[a-f0-9]{64}$/.test(checksum)||bytes>25*1024*1024))
      || (checksum && !/^[a-f0-9]{64}$/.test(checksum))
      || !Number.isSafeInteger(bytes) || bytes < 1 || bytes > MAX_FILE || all.length >= 10000) {
      throw new MotionStudioError('INVALID', 'Invalid artifact details.', 400)
    }
    if (input.resume === true && checksum) {
      // Identity is verified content, not the filename inside the render ZIP.
      // ZIP membership alone is never a proof of separately stored blobs.
      const ready = all.find(a => a.state==='ready' && a.sha256===checksum &&
        a.bytes===bytes && a.kind===kind && a.mime===mime)
      if (ready) return {uploadId:ready.id,status:'ready',exists:true,reused:true}
      // A previous commit can have timed out after the object reached B2.
      // Adopt a pending sibling only after independently checking its bytes
      // and SHA-256; never trust an uncommitted upload on metadata alone.
      const pending = all.find(a=>a.state==='pending' && a.sha256===checksum &&
        a.bytes===bytes && a.kind===kind && a.mime===mime && !a.s3UploadId)
      if(pending){
        try{
          const storage=getClipStorage()
          const observed=await storage.getObjectSizeBytes(pending.key)
          if(observed===bytes){
            const hash=createHash('sha256')
            if(bytes<=25*1024*1024)hash.update(await storage.getObjectBytes(pending.key))
            else{
              const signed=await storage.createSignedDownloadUrl(pending.key,900)
              const response=await fetch(signed,{redirect:'error',cache:'no-store'})
              if(!response.ok||!response.body)throw new Error('Unverified pending object')
              const reader=response.body.getReader()
              let count=0
              try{
                for(;;){
                  const part=await reader.read()
                  if(part.done)break
                  count+=part.value.length
                  if(count>bytes)throw new Error('Oversized pending object')
                  hash.update(part.value)
                }
              }finally{await reader.cancel()}
              if(count!==bytes)throw new Error('Incomplete pending object')
            }
            if(hash.digest('hex')===checksum){
              await db().studioAsset.upsert({where:{id:pending.id},
                create:{id:pending.id,projectId:job.projectId,workspaceId:job.workspaceId,
                  uploadId:pending.id,kind:pending.kind,filename:pending.filename,status:'ready',
                  provenanceLog:toPrismaJson({source:'producer',sha256:checksum,verifiedSha256:true})},
                update:{status:'ready'}})
              await storeArtifact(job,{...pending,state:'ready'})
              return {uploadId:pending.id,status:'ready',exists:true,reused:true}
            }
          }
        }catch{ /* Missing or incomplete object: require a fresh verified PUT. */ }
      }
    }
    const uploadId = randomUUID()
    const objectKey = 'ws/' + job.workspaceId + '/motion-studio/agent/' + job.id + '/' + uploadId + '/' + filename
    const upload = await getClipStorage().createUpload({ workspaceId: job.workspaceId, uploadId,
      filename, mime, bytes, objectKey })
    const item: Artifact = { id: uploadId, key: objectKey, kind, filename, mime, bytes, state: 'pending',
      ...(upload.s3Multipart ? { s3UploadId: upload.s3Multipart.uploadId } : {}),
      ...(elementId ? { elementId } : {}), ...(trackId ? { trackId } : {}),
      ...(checksum ? {sha256:checksum} : {}) }
    await storeArtifact(job, item)
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
    // A previous commit request can time out after B2 has finished writing.
    // On explicit retry, inspect the existing object first and skip a
    // second multipart completion if the bytes are already present.
    let preexisting=0
    if(input.retryCommit===true){
      try{preexisting=Number(await storage.getObjectSizeBytes(item.key)||0)}
      catch{preexisting=0}
    }
    if(preexisting!==item.bytes)
      await storage.completeUpload({ objectKey: item.key, s3UploadId: item.s3UploadId, parts })
    // B2 may expose the completed object slightly after completeUpload.
    // Stay on this upload ID; never force Chromium to re-encode a valid
    // segment just because the first size read races storage consistency.
    let size=0
    for(let attempt=0;attempt<4;attempt++){
      size=Number(await storage.getObjectSizeBytes(item.key)||0)
      if(size===item.bytes)break
      if(attempt<3)await new Promise(resolve=>setTimeout(resolve,500*(attempt+1)))
    }
    if (!size || size !== item.bytes || size > MAX_FILE)
      throw new MotionStudioError('INVALID', 'Uploaded size does not match the prepared object.', 400)
    if (item.sha256) {
      const hash=createHash('sha256')
      if (size<=25*1024*1024) hash.update(await storage.getObjectBytes(item.key))
      else {
        const url=await storage.createSignedDownloadUrl(item.key,900)
        const response=await fetch(url,{redirect:'error',cache:'no-store'})
        if (!response.ok || !response.body) throw new MotionStudioError('INVALID','Cannot verify uploaded media.',422)
        const reader=response.body.getReader()
        let count=0
        try {
          for (;;) {
            const {done,value}=await reader.read()
            if (done) break
            count+=value.length
            if (count>size) throw new MotionStudioError('INVALID','Uploaded media size changed.',422)
            hash.update(value)
          }
        } finally { await reader.cancel() }
        if (count!==size) throw new MotionStudioError('INVALID','Incomplete uploaded media.',422)
      }
      const actual=hash.digest('hex')
      if (actual !== item.sha256)
        throw new MotionStudioError('INVALID', 'Uploaded source does not match SHA-256.', 422)
    }
    item.state = 'ready'
    // Every producer artifact also receives a durable Transovo project asset ID.
    // This is necessary for portable manifests to reference assets by ID, never by path.
    await db().studioAsset.upsert({
      where: { id: item.id },
      create: { id: item.id, projectId: job.projectId, workspaceId: job.workspaceId,
        uploadId: item.id, kind: item.kind, filename: item.filename, status: 'ready',
        ...(item.sha256 ? {provenanceLog: toPrismaJson({source:'producer',sha256:item.sha256,verifiedSha256:true})} : {}) },
      update: { status: 'ready',
        ...(item.sha256 ? {provenanceLog: toPrismaJson({source:'producer',sha256:item.sha256,verifiedSha256:true})} : {}) },
    })
    await storeArtifact(job, item)
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
    if (coordinatorEnabled()) {
      await db().motionStudioWorkerAssignment.updateMany({where:{jobId:id,status:{in:['reserved','dispatched','running']}},
        data:{status:'failed',leaseExpiresAt:new Date()}})
      await coordinatePendingJobs(1)
    }
    return publicJob(failed)
  }
  // Render-first live delivery: keep an already-approved MP4 available while
  // publishing the immutable editable timeline and after job completion.
  // Legacy masterless live jobs remain valid; never create a render here.
  if(input.delivery==='live'){
    const versionId=str(input.portableVersionId,128)
    const durationMs=Number(input.durationMs)
    if(!versionId||!Number.isSafeInteger(durationMs)||durationMs<1||durationMs>2_147_483_647)
      throw new MotionStudioError('INVALID','Live delivery requires its committed version and duration.',400)
    const portable=await db().motionStudioPortableVersion.findFirst({
      where:{id:versionId,workspaceId:job.workspaceId,projectId:job.projectId,
        sourceJobId:id,status:'committed'},
    })
    if(!portable)throw new MotionStudioError('CONFLICT','The live project must be published by this job first.',409)
    let manifest
    try{manifest=validatePortableManifest(portable.manifest)}
    catch{throw new MotionStudioError('INVALID','Live project manifest failed validation.',400)}
    const live=toObject(manifest.liveProject)
    const format=toObject(live.format)
    if(live.schema!=='transovo.live-project/1'||Number(format.durationMs)!==durationMs)
      throw new MotionStudioError('INVALID','Live project duration or track format is missing.',400)
    const requiredIds=manifest.assets.map(a=>a.id)
    const readyAssets=await db().studioAsset.count({
      where:{workspaceId:job.workspaceId,projectId:job.projectId,
        id:{in:requiredIds},status:'ready'},
    })
    if(readyAssets!==requiredIds.length)
      throw new MotionStudioError('CONFLICT','All live scene, audio and caption assets must be ready.',409)
    const now=new Date()
    const completed=await db().$transaction(async tx=>{
      // Re-read the approved master inside the completion transaction. It
      // must match a ready MP4 belonging to this very job; an arbitrary
      // resultKey or an earlier job's master is never accepted.
      const current=await tx.motionStudioAgentJob.findUniqueOrThrow({
        where:{id},select:{resultKey:true,artifacts:true},
      })
      const approved=artifacts(current.artifacts).find(a=>
        a.state==='ready'&&a.kind==='video'&&a.mime==='video/mp4'&&
        a.filename!=='editor-base.mp4'&&a.key===current.resultKey)
      const masterKey=approved?.key??null
      const project=await tx.motionStudioProject.findUniqueOrThrow({
        where:{id:job.projectId},select:{exportInfo:true,clipProjectId:true},
      })
      const updated=await tx.motionStudioAgentJob.update({
        where:{id},data:{status:'complete',phase:'complete',progress:100,
          message:DEFAULT_STAGE_MESSAGES.complete,resultKey:masterKey,durationMs,
          completedAt:now},
      })
      await tx.motionStudioProject.update({where:{id:job.projectId},data:{
        status:'review',stage:'review',completedAt:now,
        timelineVersion:{increment:1},
        exportInfo:toPrismaJson({...toObject(project.exportInfo),
          delivery:'live',portableVersionId:versionId,
          durationMs,masterKey,smallKey:masterKey,source:'transovo_agent',
          agentJobId:id,storageDriver:masterKey?storageDriverName():undefined}),
      }})
      // Motion Studio's actual Compact Editor already owns a placeholder
      // ClipProject and ClipUpload. Attach the approved master as its canvas,
      // retaining the project and editor identities (no new editor/page).
      if(approved&&project.clipProjectId){
        const clipProject=await tx.clipProject.findFirst({
          where:{id:project.clipProjectId,workspaceId:job.workspaceId},
          select:{uploadId:true},
        })
        if(clipProject?.uploadId){
          await tx.clipUpload.updateMany({
            where:{id:clipProject.uploadId,workspaceId:job.workspaceId},
            data:{key:approved.key,bytes:BigInt(approved.bytes),mime:'video/mp4',
              filename:approved.filename,durationMs,status:'READY',
              storageDriver:storageDriverName()},
          })
        }
        await tx.clipProject.updateMany({
          where:{id:project.clipProjectId,workspaceId:job.workspaceId},
          data:{status:'READY',rangeEndMs:durationMs,
            proxyKey:approved.key,progress:100},
        })
      }
      await tx.studioActivityEvent.create({data:{projectId:job.projectId,
        stage:'review',kind:'stage',message:'Editable video ready in Compact Editor.'}})
      return updated
    })
    await db().studioActivityEvent.create({data:{projectId:job.projectId,
      stage:'complete',kind:'agent_progress',message:DEFAULT_STAGE_MESSAGES.complete,
      data:toPrismaJson({jobId:id,percent:100,delivery:'live'})}})
    if(pullProducerQueueEnabled())await releaseProducerLease(id)
    if(coordinatorEnabled())await db().motionStudioWorkerAssignment.updateMany({
      where:{jobId:id,status:{in:['reserved','dispatched','running']}},
      data:{status:'complete',leaseExpiresAt:new Date()},
    })
    await dispatchQueuedAfterFinish(job,request)
    if(coordinatorEnabled())await coordinatePendingJobs(1)
    return publicJob(completed)
  }
  const video = artifacts(job.artifacts).find(a => a.kind === 'video' && a.filename !== 'editor-base.mp4' && a.mime === 'video/mp4' && a.state === 'ready' && (!job.resultKey || a.key===job.resultKey))
  if (!video) throw new MotionStudioError('CONFLICT', 'Upload and commit an MP4 before completing.', 409)
  const picture = editorPicture(job.artifacts, video)
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
        masterKey: video.key, smallKey: video.key, ...(picture.id!==video.id ? {editorBaseKey:picture.key} : {}), durationMs, source: 'transovo_agent', agentJobId: id,
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
          key: picture.key, bytes: BigInt(picture.bytes), durationMs, mime: 'video/mp4',
          filename: picture.filename, status: 'READY', storageDriver: storageDriverName(),
        } })
      }
      await tx.clipProject.update({ where: { id: motionProject.clipProjectId }, data: {
        status: 'READY', stage: 'motion_studio', progress: 100,
        rangeEndMs: durationMs, proxyKey: picture.key,
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
  if (coordinatorEnabled()) await db().motionStudioWorkerAssignment.updateMany({
    where:{jobId:id,status:{in:['reserved','dispatched','running']}},
    data:{status:'complete',leaseExpiresAt:new Date()},
  })
  await dispatchQueuedAfterFinish(job, request)
  if (coordinatorEnabled()) await coordinatePendingJobs(1)
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
  } else if (wantsEdit && !latest?.resultKey &&
    !await db().motionStudioAgentJob.findFirst({
      where: { projectId, workspaceId, status: 'complete' }, select: { id: true } }) &&
    !await manualEditorBase(workspaceId,projectId)) {
    response = 'I understand the change. Once your video or manual timeline is ready, I can submit this as a revision.'
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
        ...((pullProducerQueueEnabled() || coordinatorEnabled()) ? { leaseOwner: null, leaseIdHash: null, leaseExpiresAt: null } : {}),
        message: "We're waiting for your direction…" } })
    }
    return tx.motionStudioAgentMessage.create({ data: { id:'msmsg_'+randomUUID(),
      projectId:job.projectId,jobId:id,role:'agent',text } })
  })
  if (input.needsInput===true && coordinatorEnabled()) {
    await db().motionStudioWorkerAssignment.updateMany({
      where:{jobId:id,status:{in:['reserved','dispatched','running']}},
      data:{status:'paused',leaseExpiresAt:new Date()},
    })
    await coordinatePendingJobs(1)
  }
  return { id:item.id, role:'agent',text:item.text,timestamp:item.createdAt.toISOString() }
}

/** An active producer can recover *ready* artifacts from an earlier job of the
 * same project and workspace, including incomplete attempts. URLs are minted
 * on demand; neither stale tokens nor foreign project files can be reused. */
export async function botRecoveryArtifacts(id: string, request: Request, sourceJobId: string) {
  const job = await requireBotJob(id, request)
  if (isDone(job.status)) throw new MotionStudioError('CONFLICT', 'Finished jobs cannot access recovery assets.', 409)
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
  const resultKey = job.resultKey
  const asset = artifacts(job.artifacts).find(a => a.state === 'ready' && a.key === resultKey)
  if (!asset) throw new MotionStudioError('CONFLICT','That version has no completed MP4.',409)
  const picture = editorPicture(job.artifacts, asset)
  const durationMs = job.durationMs || Number(toObject(project.exportInfo).durationMs) || 0
  if (!Number.isSafeInteger(durationMs) || durationMs <= 0) throw new MotionStudioError('CONFLICT','Version duration is unavailable.',409)
  const source = await dbi.clipProject.findFirst({ where: { id:project.clipProjectId,workspaceId },
    select:{uploadId:true} })
  await dbi.$transaction(async tx => {
    await tx.motionStudioProject.update({ where:{id:projectId},data:{
      status:'review',stage:'review',timelineVersion:{increment:1},exportInfo:toPrismaJson({
        masterKey:job.resultKey,smallKey:job.resultKey,...(picture.id!==asset.id ? {editorBaseKey:picture.key} : {}),durationMs,source:'transovo_agent',
        agentJobId:jobId,storageDriver:storageDriverName()
      }) } })
    if (source?.uploadId) await tx.clipUpload.update({ where: { id:source.uploadId }, data:{
      key:picture.key,bytes:BigInt(picture.bytes),filename:picture.filename,mime:'video/mp4',
      durationMs,status:'READY',storageDriver:storageDriverName() } })
    await tx.clipProject.update({ where:{id:project.clipProjectId!},data:{
      status:'READY',rangeEndMs:durationMs,proxyKey:picture.key,progress:100 } })
  })
  return { activeJobId:jobId,revision:job.revision }
}


/** Private operational telemetry; never included in publicJob or customer chat. */
export async function botRecordUsage(id: string, request: Request, raw: unknown) {
  const job=await requireBotJob(id,request)
  const input=toObject(raw)
  if(!Array.isArray(input.items))throw new MotionStudioError('INVALID','Usage items required.',400)
  const items=input.items.slice(0,100).map(v=>{
    const item=toObject(v)
    const provider=str(item.provider,80)
    const units=Number(item.units),usd=Number(item.usd)
    if(!provider||!Number.isFinite(units)||units<0||
      !Number.isFinite(usd)||usd<0)
      throw new MotionStudioError('INVALID','Invalid usage item.',400)
    return {provider,units,usd}
  })
  const modalItems=items.filter(x=>x.provider==='modal')
  const usageId=str(input.usageId,120)||'legacy'
  if(!/^[A-Za-z0-9_.-]{1,120}$/.test(usageId))
    throw new MotionStudioError('INVALID','Invalid usage receipt ID.',400)
  const updated=await db().$transaction(async tx=>{
    await tx.$queryRaw`SELECT "id" FROM "MotionStudioAgentJob" WHERE "id"=${id} FOR UPDATE`
    const current=await tx.motionStudioAgentJob.findUniqueOrThrow({where:{id}})
    if(current.tokenHash!==job.tokenHash||current.workspaceId!==job.workspaceId)
      throw new MotionStudioError('CONFLICT','Job assignment changed.',409)
    const existing=toObject(current.usage)
    const runs=Array.isArray(existing.modalRuns)?existing.modalRuns
      .map(v=>toObject(v)).filter(x=>typeof x.id==='string'): []
    if(modalItems.length){
      const usd=modalItems.reduce((n,x)=>n+x.usd,0)
      const units=modalItems.reduce((n,x)=>n+x.units,0)
      if(!Number.isFinite(usd)||usd<0||usd>2000)
        throw new MotionStudioError('INVALID','Modal usage exceeds safe bounds.',400)
      const at=runs.findIndex(x=>x.id===usageId)
      const receipt={id:usageId,usd,units}
      if(at<0)runs.push(receipt)
      else runs[at]=receipt
      if(runs.length>100)
        throw new MotionStudioError('INVALID','Too many Modal usage receipts.',400)
      const totalUsd=runs.reduce((n,x)=>n+Number(x.usd||0),0)
      const totalUnits=runs.reduce((n,x)=>n+Number(x.units||0),0)
      const costUsdMicros=Math.round(totalUsd*1_000_000)
      if(!Number.isSafeInteger(costUsdMicros)||costUsdMicros>2_000_000_000)
        throw new MotionStudioError('INVALID','Modal usage exceeds safe bounds.',400)
      const prior=await tx.aiUsage.findFirst({
        where:{provider:'modal',generationId:id,workspaceId:job.workspaceId},
        orderBy:{createdAt:'desc'},select:{id:true},
      })
      const record={workspaceId:job.workspaceId,projectId:job.projectId,
        generationId:id,provider:'modal',model:'motion-studio-render',
        units:totalUnits,unitType:'render_units',costUsdMicros}
      if(prior)await tx.aiUsage.update({where:{id:prior.id},data:record})
      else await tx.aiUsage.create({data:record})
    }
    return tx.motionStudioAgentJob.update({where:{id},data:{usage:toPrismaJson({
      items,modalRuns:runs,recordedAt:new Date().toISOString()
    })}})
  })
  return {jobId:updated.id,stored:true}
}
