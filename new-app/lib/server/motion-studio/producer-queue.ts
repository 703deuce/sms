import 'server-only'
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import { getPrisma } from '@/lib/server/db'
import { MotionStudioError } from '@/lib/server/motion-studio/errors'

const db = () => getPrisma()
const LEASE_MS = 5 * 60_000
const TOKEN_MS = 36 * 3600_000
const hash = (value: string) => createHash('sha256').update(value).digest('hex')
const safeEqual = (a: string, b: string) => {
  const left = Buffer.from(hash(a), 'hex'), right = Buffer.from(hash(b), 'hex')
  return timingSafeEqual(left, right)
}
export function pullProducerQueueEnabled() { return process.env.MOTION_STUDIO_PULL_QUEUE === '1' }
function producerSecret(): string {
  const secret = process.env.MOTION_STUDIO_PRODUCER_QUEUE_KEY || ''
  if (secret.length < 32) throw new MotionStudioError('INTERNAL', 'Producer queue secret must be configured.', 503)
  return secret
}
export function requireProducerQueue(request: Request) {
  const authorization = request.headers.get('authorization') || ''
  const provided = authorization.startsWith('Bearer ') ? authorization.slice(7) : ''
  if (!provided || !safeEqual(provided, producerSecret()))
    throw new MotionStudioError('UNAUTHENTICATED', 'Producer queue credential required.', 401)
}
function urlForJob(request: Request, id: string): string {
  const raw = process.env.MOTION_STUDIO_AGENT_PUBLIC_URL
  if (!raw) throw new MotionStudioError('INTERNAL', 'MOTION_STUDIO_AGENT_PUBLIC_URL is required.', 503)
  const url = new URL(raw)
  if (url.protocol !== 'https:' && !(process.env.NODE_ENV !== 'production' && ['127.0.0.1','localhost'].includes(url.hostname)))
    throw new MotionStudioError('INVALID', 'Producer URL must use HTTPS.', 503)
  return url.origin + '/api/motion-studio/agent/jobs/' + encodeURIComponent(id)
}
function validWorkerId(raw: unknown): string {
  const worker = typeof raw === 'string' ? raw.trim() : ''
  if (!/^[a-zA-Z0-9_.:-]{3,96}$/.test(worker))
    throw new MotionStudioError('INVALID', 'workerId must be 3–96 safe characters.', 400)
  return worker
}
type ClaimedRow = { id: string; projectId: string; workspaceId: string; userId: string; parentJobId: string | null; revision: number }
/** Pull queue: one in-flight claim per workspace, oldest eligible job first.
 * SKIP LOCKED makes parallel workers safe. Expired claims are recoverable.
 * No worker-local state is required to pick up the project. */
export async function claimProducerJob(request: Request, raw: unknown) {
  requireProducerQueue(request)
  if (!pullProducerQueueEnabled()) throw new MotionStudioError('DISABLED', 'Pull queue is disabled.', 409)
  const worker = validWorkerId((raw as {workerId?: unknown} | null)?.workerId)
  const jobUrlOrigin = process.env.MOTION_STUDIO_AGENT_PUBLIC_URL
  if (!jobUrlOrigin) throw new MotionStudioError('INTERNAL', 'Producer public URL missing.', 503)
  // After repeated lost leases, do not strand the queue item forever.
  await db().motionStudioAgentJob.updateMany({ where: {
    leaseAttempts: { gte: 20 },
    status: { in: ['queued', 'dispatched', 'running'] },
    OR: [{ leaseExpiresAt: null }, { leaseExpiresAt: { lt: new Date() } }],
  }, data: { status: 'failed', phase: 'failed', completedAt: new Date(),
    message: 'Production could not be resumed after repeated worker interruptions.' } })
  return db().$transaction(async tx => {
    const rows = await tx.$queryRaw<ClaimedRow[]>`
      SELECT j."id", j."projectId", j."workspaceId", j."userId", j."parentJobId", j."revision"
      FROM "MotionStudioAgentJob" j
      WHERE (j."status" = 'queued'
        OR (j."status" IN ('dispatched','running')
            AND j."leaseExpiresAt" IS NOT NULL AND j."leaseExpiresAt" < CURRENT_TIMESTAMP))
        AND j."leaseAttempts" < 20
        AND NOT EXISTS (
          SELECT 1 FROM "MotionStudioAgentJob" active
          WHERE active."workspaceId" = j."workspaceId"
            AND active."id" <> j."id"
            AND active."leaseExpiresAt" > CURRENT_TIMESTAMP
            AND active."status" IN ('dispatched','running')
        )
      ORDER BY j."createdAt" ASC, j."id" ASC
      FOR UPDATE OF j SKIP LOCKED
      LIMIT 1
    `
    const row = rows[0]
    if (!row) return { job: null }
    // Serialize claims per workspace as well as per job; concurrent pollers
    // must not lease two projects from the same workspace simultaneously.
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${row.workspaceId}))`
    const active = await tx.motionStudioAgentJob.count({ where: {
      workspaceId: row.workspaceId, id: { not: row.id },
      status: { in: ['dispatched', 'running'] }, leaseExpiresAt: { gt: new Date() },
    } })
    if (active) return { job: null }
    const token = randomBytes(32).toString('base64url')
    const leaseId = randomBytes(32).toString('base64url')
    const leaseExpiresAt = new Date(Date.now() + LEASE_MS)
    const tokenExpiresAt = new Date(Date.now() + TOKEN_MS)
    await tx.motionStudioAgentJob.update({ where: { id: row.id }, data: {
      leaseOwner: worker, leaseIdHash: hash(row.id + ':' + leaseId),
      leaseExpiresAt, leaseAttempts: { increment: 1 }, status: 'dispatched',
      phase: 'accepted', tokenHash: hash(row.id + ':' + token), tokenExpiresAt,
      dispatchedAt: new Date(), message: 'An available producer is working on your video.',
    } })
    return { job: {
      jobId: row.id, workspaceId: row.workspaceId, projectId: row.projectId,
      userId: row.userId, parentJobId: row.parentJobId, revision: row.revision,
      jobUrl: urlForJob(request, row.id), jobToken: token, leaseId,
      leaseExpiresAt: leaseExpiresAt.toISOString(), tokenExpiresAt: tokenExpiresAt.toISOString(),
      workerId: worker,
    } }
  })
}
type LeaseInput = { jobId?: unknown; workerId?: unknown; leaseId?: unknown; action?: unknown }
export async function updateProducerLease(request: Request, raw: unknown) {
  requireProducerQueue(request)
  if (!pullProducerQueueEnabled()) throw new MotionStudioError('DISABLED', 'Pull queue is disabled.', 409)
  const input = (raw && typeof raw === 'object' ? raw : {}) as LeaseInput
  const workerId = validWorkerId(input.workerId)
  const jobId = typeof input.jobId === 'string' ? input.jobId : ''
  const leaseId = typeof input.leaseId === 'string' ? input.leaseId : ''
  const action = input.action === 'renew' ? 'renew' : input.action === 'heartbeat' ? 'heartbeat' : ''
  if (!/^msaj_[a-z0-9-]{36}$/.test(jobId) || leaseId.length !== 43 || !action)
    throw new MotionStudioError('INVALID', 'Valid jobId, leaseId and action required.', 400)
  const job = await db().motionStudioAgentJob.findUnique({ where: { id: jobId } })
  if (!job || job.leaseOwner !== workerId || !job.leaseIdHash ||
      !safeEqual(job.leaseIdHash, hash(jobId + ':' + leaseId)) ||
      !job.leaseExpiresAt || job.leaseExpiresAt.getTime() <= Date.now() ||
      !['dispatched','running'].includes(job.status))
    throw new MotionStudioError('CONFLICT', 'Lease is no longer owned by this worker. Claim again.', 409)
  const deadline = new Date(Date.now() + LEASE_MS)
  const token = action === 'renew' ? randomBytes(32).toString('base64url') : null
  const tokenExpiresAt = token ? new Date(Date.now() + TOKEN_MS) : undefined
  const result = await db().motionStudioAgentJob.updateMany({ where: {
    id: jobId, leaseOwner: workerId, leaseIdHash: job.leaseIdHash,
    leaseExpiresAt: { gt: new Date() }, status: { in: ['dispatched','running'] },
  }, data: {
    leaseExpiresAt: deadline,
    ...(token ? { tokenHash: hash(jobId + ':' + token), tokenExpiresAt } : {}),
  } })
  if (!result.count) throw new MotionStudioError('CONFLICT', 'Lease changed; claim job again.', 409)
  return { jobId, workerId, action, leaseExpiresAt: deadline.toISOString(),
    ...(token ? { jobToken: token, tokenExpiresAt: tokenExpiresAt!.toISOString() } : {}) }
}
export async function releaseProducerLease(jobId: string) {
  await db().motionStudioAgentJob.updateMany({
    where: { id: jobId }, data: { leaseOwner: null, leaseIdHash: null, leaseExpiresAt: null },
  })
}
