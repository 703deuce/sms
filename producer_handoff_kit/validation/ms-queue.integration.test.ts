// LOCAL-ONLY integration harness (untracked; not committed). Uses throwaway Postgres on 127.0.0.1:55432.
import { beforeAll, beforeEach, afterAll, describe, expect, it, vi } from 'vitest'
import { createHash, randomUUID } from 'node:crypto'

const st = vi.hoisted(() => ({ intent: 'edit' as 'edit' | 'question', fetch: null as any }))
vi.mock('@/lib/storage', () => ({
  createReadableSignedUrl: async (key: string, ttl: number) => 'https://signed.invalid/obj' + key.length + '?ttl=' + ttl + '&n=' + Math.random().toString(36).slice(2),
  getClipStorage: () => ({
    createUpload: async () => ({ mode: 'signed', signedPut: 'https://signed.invalid/put' }),
    completeUpload: async () => {}, getObjectSizeBytes: async () => 1234,
  }),
  storageDriverName: () => 'test',
}))
vi.mock('@/lib/server/motion-studio/chat-assistant', () => ({
  interpretCustomerMessage: async () => ({ intent: st.intent, reply: 'OK.', instruction: 'Make the intro gold.' }),
}))

if (!String(process.env.DATABASE_URL).includes('127.0.0.1:55432')) throw new Error('refusing: not local throwaway DB')

import { getPrisma } from '@/lib/server/db'
import * as bridge from '@/lib/server/motion-studio/agent-bridge'
import { claimProducerJob, updateProducerLease } from '@/lib/server/motion-studio/producer-queue'

const db = getPrisma()
const QKEY = 'q'.repeat(48)
const qreq = (k = QKEY) => new Request('https://preview.transovo.ai/api/motion-studio/agent/queue/claim', { method: 'POST', headers: { Authorization: 'Bearer ' + k } })
const breq = (tok: string) => new Request('https://preview.transovo.ai/api/motion-studio/agent/jobs/x', { headers: { Authorization: 'Bearer ' + tok } })
const creq = (key: string) => new Request('https://preview.transovo.ai/api/motion-studio/agent/projects/p/chat', { method: 'POST', headers: { 'Idempotency-Key': key } })
const sha = (s: string) => createHash('sha256').update(s).digest('hex')
const pull = (on: boolean) => { if (on) process.env.MOTION_STUDIO_PULL_QUEUE = '1'; else delete process.env.MOTION_STUDIO_PULL_QUEUE }
const msg = async (p: Promise<unknown>) => { try { await p; return 'OK' } catch (e: any) { return `${e.status ?? ''} ${e.message}` } }

async function project(ws: string, id = 'msp_' + randomUUID()) {
  await db.motionStudioProject.create({ data: { id, workspaceId: ws, userId: 'u_' + ws, title: 'T', workflow: 'documentary',
    settings: {}, status: 'review', idempotencyKey: id } })
  return id
}
async function job(ws: string, projectId: string, extra: Record<string, any> = {}) {
  const id = 'msaj_' + randomUUID(); const token = 'tok_' + randomUUID()
  await db.motionStudioAgentJob.create({ data: { id, projectId, workspaceId: ws, userId: extra.userId ?? 'u_' + ws, idempotencyKey: id,
    tokenHash: sha(id + ':' + token), tokenExpiresAt: new Date(Date.now() + 3600_000), status: 'queued', phase: 'dispatch',
    artifacts: [], ...extra } })
  return { id, token }
}

beforeAll(() => {
  process.env.MOTION_STUDIO_PRODUCER_QUEUE_KEY = QKEY
  process.env.MOTION_STUDIO_AGENT_PUBLIC_URL = 'https://preview.transovo.ai'
  process.env.GROKBOT_WEBHOOK_URL = 'https://producer.invalid/hook'
  process.env.GROKBOT_WEBHOOK_KEY = 'w'.repeat(48)
})
beforeEach(async () => {
  await db.motionStudioAgentJob.deleteMany({}); await db.motionStudioAgentMessage.deleteMany({})
  await db.motionStudioProject.deleteMany({}); await db.studioActivityEvent.deleteMany({})
  st.fetch = vi.fn(async () => ({ ok: true, status: 200 })); vi.stubGlobal('fetch', st.fetch)
  st.intent = 'edit'
})
afterAll(async () => { vi.unstubAllGlobals(); await db.$disconnect() })

describe('a) legacy webhook question -> checkpoint -> answer -> resume', () => {
  it('runs', async () => {
    pull(false)
    const p = await project('ws_a')
    const j = await job('ws_a', p, { status: 'running' })
    expect(await msg(bridge.botSaveCheckpoint(j.id, breq(j.token), { revision: 1, checkpoint: { stage: 'visuals', finishedSceneIds: ['s1'] } }))).toBe('OK')
    await bridge.botPostMessage(j.id, breq(j.token), { text: 'Gold or silver logo?', needsInput: true })
    expect((await db.motionStudioAgentJob.findUnique({ where: { id: j.id } }))!.status).toBe('needs_input')
    // first delivery fails -> customer sees 503
    st.fetch.mockResolvedValueOnce({ ok: false, status: 500 })
    const r1 = await msg(bridge.submitAgentRevision('ws_a', 'u_ws_a', p, creq('ans-1'), { instruction: 'Gold please', answerInput: true }))
    const oldTokAfterFailedDelivery = await msg(bridge.botGetCheckpoint(j.id, breq(j.token)))
    const r2 = await msg(bridge.submitAgentRevision('ws_a', 'u_ws_a', p, creq('ans-1'), { instruction: 'Gold please', answerInput: true }))
    const b1 = JSON.parse(st.fetch.mock.calls[0][1].body), b2 = JSON.parse(st.fetch.mock.calls[1][1].body)
    console.log('A', { r1, r2, oldTokAfterFailedDelivery, fields: Object.keys(b2), jobUrl: b2.jobUrl, sameToken: b1.jobToken === b2.jobToken })
    expect(b2).toMatchObject({ action: 'answer_input', jobId: j.id, workspaceId: 'ws_a', projectId: p, idempotencyKey: 'ans-1', text: 'Gold please' })
    expect(b2.jobUrl).toBe('https://preview.transovo.ai/api/motion-studio/agent/jobs/' + j.id)
    expect(b1.jobToken).toBe(b2.jobToken)
    // third identical retry after success -> no new webhook
    await bridge.submitAgentRevision('ws_a', 'u_ws_a', p, creq('ans-1'), { instruction: 'Gold please', answerInput: true })
    expect(st.fetch).toHaveBeenCalledTimes(2)
    const row = (await db.motionStudioAgentJob.findUnique({ where: { id: j.id } }))!
    expect(row.status).toBe('running'); expect(row.waitingStartedAt).toBeNull()
    expect(await msg(bridge.botGetCheckpoint(j.id, breq(j.token)))).toMatch(/401/)
    const ctx: any = await bridge.botGetAssignment(j.id, breq(b2.jobToken))
    expect(ctx.id).toBe(j.id); expect(ctx.checkpoint.state.stage).toBe('visuals'); expect(ctx.resumeAnswer).toBe('Gold please')
    const msgs = await db.motionStudioAgentMessage.findMany({ where: { projectId: p, role: 'customer' } })
    expect(msgs).toHaveLength(1)
  })
})

describe('b) expired token -> renew', () => {
  it('runs', async () => {
    pull(true)
    const p = await project('ws_b'); await job('ws_b', p)
    const c = (await claimProducerJob(qreq(), { workerId: 'worker-b1' })).job!
    expect(await msg(bridge.botGetCheckpoint(c.jobId, breq(c.jobToken)))).toBe('OK')
    await db.motionStudioAgentJob.update({ where: { id: c.jobId }, data: { tokenExpiresAt: new Date(Date.now() - 1000) } })
    const expired = await msg(bridge.botGetCheckpoint(c.jobId, breq(c.jobToken)))
    const r = await updateProducerLease(qreq(), { action: 'renew', jobId: c.jobId, workerId: 'worker-b1', leaseId: c.leaseId })
    const fresh = await msg(bridge.botGetCheckpoint(c.jobId, breq(r.jobToken!)))
    const old = await msg(bridge.botGetCheckpoint(c.jobId, breq(c.jobToken)))
    const wrongWorker = await msg(updateProducerLease(qreq(), { action: 'renew', jobId: c.jobId, workerId: 'worker-zz', leaseId: c.leaseId }))
    const badKey = await msg(updateProducerLease(qreq('x'.repeat(48)), { action: 'renew', jobId: c.jobId, workerId: 'worker-b1', leaseId: c.leaseId }))
    await db.motionStudioAgentJob.update({ where: { id: c.jobId }, data: { leaseExpiresAt: new Date(Date.now() - 1000) } })
    const afterLeaseExpiry = await msg(updateProducerLease(qreq(), { action: 'renew', jobId: c.jobId, workerId: 'worker-b1', leaseId: c.leaseId }))
    const row = (await db.motionStudioAgentJob.findUnique({ where: { id: c.jobId } }))!
    console.log('B', { expired, fresh, old, wrongWorker, badKey, afterLeaseExpiry, leaseHashed: row.leaseIdHash !== c.leaseId && row.leaseIdHash!.length === 64, tokenHashed: !row.tokenHash.includes(r.jobToken!) })
    expect(expired).toMatch(/401/); expect(fresh).toBe('OK'); expect(old).toMatch(/401/)
    expect(wrongWorker).toMatch(/409/); expect(badKey).toMatch(/401/); expect(afterLeaseExpiry).toMatch(/409/)
  })
})

describe('c) reclaim, resume, concurrency, workspace cap', () => {
  it('reclaim after lease expiry with checkpoint + resumeAnswer', async () => {
    pull(true)
    const p = await project('ws_c'); await job('ws_c', p)
    const A = (await claimProducerJob(qreq(), { workerId: 'worker-a' })).job!
    await bridge.botSaveCheckpoint(A.jobId, breq(A.jobToken), { revision: 1, checkpoint: { stage: 'scenes', finishedSceneIds: ['s1'] } })
    await bridge.botPostMessage(A.jobId, breq(A.jobToken), { text: 'Which logo?', needsInput: true })
    const waitRow = (await db.motionStudioAgentJob.findUnique({ where: { id: A.jobId } }))!
    const nothingWhileWaiting = await claimProducerJob(qreq(), { workerId: 'worker-b' })
    await bridge.submitAgentRevision('ws_c', 'u_ws_c', p, creq('ans-c'), { instruction: 'The round one', answerInput: true })
    const queuedRow = (await db.motionStudioAgentJob.findUnique({ where: { id: A.jobId } }))!
    const B = (await claimProducerJob(qreq(), { workerId: 'worker-b' })).job!
    const ctxB: any = await bridge.botGetAssignment(B.jobId, breq(B.jobToken))
    // B dies; lease expires without heartbeat; C reclaims
    await db.motionStudioAgentJob.update({ where: { id: B.jobId }, data: { leaseExpiresAt: new Date(Date.now() - 1000) } })
    const bHeartbeat = await msg(updateProducerLease(qreq(), { action: 'heartbeat', jobId: B.jobId, workerId: 'worker-b', leaseId: B.leaseId }))
    const bTokenAfterExpiry = await msg(bridge.botGetCheckpoint(B.jobId, breq(B.jobToken)))
    const C = (await claimProducerJob(qreq(), { workerId: 'worker-c' })).job!
    const ctxC: any = await bridge.botGetAssignment(C.jobId, breq(C.jobToken))
    const row = (await db.motionStudioAgentJob.findUnique({ where: { id: C.jobId } }))!
    console.log('C1', { waitLeaseReleased: waitRow.leaseOwner === null, nothingWhileWaiting, queuedStatus: queuedRow.status,
      sameJob: B.jobId === A.jobId && C.jobId === A.jobId, resumeB: ctxB.resumeAnswer, cpB: ctxB.checkpoint?.state?.stage,
      bHeartbeat, bTokenAfterExpiry, resumeC: ctxC.resumeAnswer, cpC: ctxC.checkpoint?.state?.stage, attempts: row.leaseAttempts, owner: row.leaseOwner })
    expect(nothingWhileWaiting).toEqual({ job: null })
    expect(B.jobId).toBe(A.jobId); expect(C.jobId).toBe(A.jobId)
    expect(ctxB.resumeAnswer).toBe('The round one'); expect(ctxC.checkpoint.state.stage).toBe('scenes')
    expect(bHeartbeat).toMatch(/409/); expect(bTokenAfterExpiry).toMatch(/401/)
  })
  it('simultaneous claims: one job -> exactly one winner', async () => {
    pull(true)
    const p = await project('ws_d'); await job('ws_d', p)
    const res = await Promise.all(Array.from({ length: 12 }, (_, i) => claimProducerJob(qreq(), { workerId: 'w-' + i }).catch(e => ({ err: e.message }))))
    const winners = res.filter((r: any) => r.job); const errs = res.filter((r: any) => r.err)
    console.log('C2', { winners: winners.length, errs: errs.map((e: any) => e.err) })
    expect(winners).toHaveLength(1)
  })
  it('one active claim per workspace under concurrency; other workspace still served', async () => {
    pull(true)
    const p1 = await project('ws_e'), p2 = await project('ws_e'), p3 = await project('ws_f')
    await job('ws_e', p1); await job('ws_e', p2); await job('ws_f', p3)
    const res = await Promise.all(Array.from({ length: 12 }, (_, i) => claimProducerJob(qreq(), { workerId: 'w-' + i }).catch(e => ({ err: e.message }))))
    const won = res.filter((r: any) => r.job).map((r: any) => r.job.workspaceId)
    const active = await db.motionStudioAgentJob.groupBy({ by: ['workspaceId'], where: { status: 'dispatched', leaseExpiresAt: { gt: new Date() } }, _count: true })
    console.log('C3', { won, active, errs: res.filter((r: any) => r.err).map((e: any) => e.err) })
    expect(won.filter(w => w === 'ws_e')).toHaveLength(1)
    expect(won.filter(w => w === 'ws_f')).toHaveLength(1)
  })
  it('repeated sequential rounds of concurrency do not double-claim a workspace', async () => {
    pull(true)
    let doubles = 0
    for (let round = 0; round < 15; round++) {
      await db.motionStudioAgentJob.deleteMany({})
      const p1 = await project('ws_g' + round), p2 = await project('ws_g' + round)
      await job('ws_g' + round, p1); await job('ws_g' + round, p2)
      const res = await Promise.all(Array.from({ length: 6 }, (_, i) => claimProducerJob(qreq(), { workerId: 'w-' + i }).catch(() => ({}))))
      if (res.filter((r: any) => r.job).length > 1) doubles++
    }
    console.log('C4', { doubles })
    expect(doubles).toBe(0)
  })
})

describe('d) failed production keeps queued edits, later success dispatches them', () => {
  it('runs', async () => {
    pull(true)
    const ws = 'ws_h', user = 'u_d'
    const p = await project(ws)
    await job(ws, p, { status: 'complete', resultKey: 'ws/ws_h/v0.mp4', userId: user, revision: 0, completedAt: new Date() })
    const j1 = await job(ws, p, { userId: user, revision: 1 })
    const A = (await claimProducerJob(qreq(), { workerId: 'worker-a' })).job!
    expect(A.jobId).toBe(j1.id)
    st.intent = 'edit'
    await bridge.submitAgentRevision(ws, user, p, creq('edit-1'), { instruction: 'Make the intro gold' })
    const queued1 = await db.motionStudioAgentMessage.count({ where: { projectId: p, role: 'queued_edit' } })
    await bridge.botFinish(A.jobId, breq(A.jobToken), { status: 'failed' })
    const queuedAfterFail = await db.motionStudioAgentMessage.count({ where: { projectId: p, role: 'queued_edit' } })
    const jobsAfterFail = await db.motionStudioAgentJob.count({ where: { projectId: p } })
    // customer asks for a new edit after the failure
    const after = await bridge.submitAgentRevision(ws, user, p, creq('edit-2'), { instruction: 'Also add captions' })
    const thread = await db.motionStudioAgentMessage.findMany({ where: { projectId: p, role: 'agent' }, orderBy: { createdAt: 'desc' }, take: 1 })
    // Simulate a later revision production that succeeds
    const j2 = await job(ws, p, { userId: user, revision: 2 })
    const B = (await claimProducerJob(qreq(), { workerId: 'worker-b' })).job!
    expect(B.jobId).toBe(j2.id)
    const prep: any = await bridge.botAssets(B.jobId, breq(B.jobToken), { action: 'prepare', filename: 'out.mp4', kind: 'video', mime: 'video/mp4', bytes: 1234 })
    await bridge.botAssets(B.jobId, breq(B.jobToken), { action: 'commit', uploadId: prep.uploadId })
    await bridge.botFinish(B.jobId, breq(B.jobToken), { durationMs: 30000 })
    const sent = await db.motionStudioAgentMessage.count({ where: { projectId: p, role: 'queued_sent' } })
    const stillQueued = await db.motionStudioAgentMessage.count({ where: { projectId: p, role: 'queued_edit' } })
    const newest = await db.motionStudioAgentJob.findFirst({ where: { projectId: p }, orderBy: { createdAt: 'desc' } })
    const leaseReleased = (await db.motionStudioAgentJob.findUnique({ where: { id: B.jobId } }))!.leaseOwner === null
    console.log('D', { queued1, queuedAfterFail, jobsAfterFail, afterFailEditJob: after.job?.status ?? null, afterFailReply: thread[0]?.text,
      sent, stillQueued, followUp: { status: newest?.status, revision: newest?.revision, key: newest?.idempotencyKey }, leaseReleased })
    expect(queuedAfterFail).toBeGreaterThan(0)
    expect(sent).toBeGreaterThan(0); expect(newest?.status).toBe('queued')
  })
})

describe('e) recovery-assets scoping', () => {
  it('runs', async () => {
    pull(true)
    const p = await project('ws_i'), pOther = await project('ws_i'), pX = await project('ws_j')
    const arts = [{ id: 'a1', key: 'ws/ws_i/motion-studio/agent/old/a1/scene1.mp4', kind: 'media', filename: 'scene1.mp4', mime: 'video/mp4', bytes: 10, state: 'ready' },
      { id: 'a2', key: 'ws/ws_i/x/a2.mp4', kind: 'media', filename: 'pending.mp4', mime: 'video/mp4', bytes: 10, state: 'pending' }]
    const old = await job('ws_i', p, { status: 'failed', artifacts: arts, checkpoint: { revision: 2, state: { stage: 'scenes' } } })
    const otherProj = await job('ws_i', pOther, { status: 'failed', artifacts: arts })
    const otherWs = await job('ws_j', pX, { status: 'failed', artifacts: arts })
    const cur = await job('ws_i', p)
    const C = (await claimProducerJob(qreq(), { workerId: 'worker-r' })).job!
    expect(C.jobId).toBe(cur.id)
    const r1: any = await bridge.botRecoveryArtifacts(C.jobId, breq(C.jobToken), old.id)
    const r2: any = await bridge.botRecoveryArtifacts(C.jobId, breq(C.jobToken), old.id)
    const crossProj = await msg(bridge.botRecoveryArtifacts(C.jobId, breq(C.jobToken), otherProj.id))
    const crossWs = await msg(bridge.botRecoveryArtifacts(C.jobId, breq(C.jobToken), otherWs.id))
    const badTok = await msg(bridge.botRecoveryArtifacts(C.jobId, breq('nope'), old.id))
    const oldTok = await msg(bridge.botRecoveryArtifacts(old.id, breq(old.token), old.id))
    console.log('E', { count: r1.artifacts.length, fields: Object.keys(r1.artifacts[0]), hasKey: JSON.stringify(r1).includes('ws/ws_i'),
      fresh: r1.artifacts[0].url !== r2.artifacts[0].url, cp: r1.checkpoint, crossProj, crossWs, badTok, oldJobTokenOnFailedJob: oldTok })
    expect(r1.artifacts).toHaveLength(1); expect(r1.artifacts[0].url).toMatch(/^https:/)
    expect(crossProj).toMatch(/404/); expect(crossWs).toMatch(/404/); expect(badTok).toMatch(/401/)
  })
})

describe('f) 24h deadline uses waitingStartedAt', () => {
  it('runs (legacy webhook mode)', async () => {
    pull(false)
    const p = await project('ws_k'); const j = await job('ws_k', p, { status: 'running' })
    await bridge.botPostMessage(j.id, breq(j.token), { text: 'Pick a song?', needsInput: true })
    const start = new Date(Date.now() - (24 * 3600_000 - 60_000))
    await db.motionStudioAgentJob.update({ where: { id: j.id }, data: { waitingStartedAt: start } })
    await bridge.botSaveCheckpoint(j.id, breq(j.token), { revision: 1, checkpoint: { stage: 'music' } })
    await bridge.botProgress(j.id, breq(j.token), { stage: 'scenes', percent: 80 })
    await bridge.botPostMessage(j.id, breq(j.token), { text: 'Follow-up question?', needsInput: true })
    const r1 = (await db.motionStudioAgentJob.findUnique({ where: { id: j.id } }))!
    await db.motionStudioAgentJob.update({ where: { id: j.id }, data: { waitingStartedAt: new Date(Date.now() - 24 * 3600_000 - 1000) } })
    const late = await msg(bridge.submitAgentRevision('ws_k', 'u_ws_k', p, creq('late'), { instruction: 'Song 2', answerInput: true }))
    const r2 = (await db.motionStudioAgentJob.findUnique({ where: { id: j.id } }))!
    // pull sweep with recent updatedAt but old waitingStartedAt
    pull(true)
    const p2 = await project('ws_l'); const j2 = await job('ws_l', p2, { status: 'needs_input', waitingStartedAt: new Date(Date.now() - 25 * 3600_000) })
    await claimProducerJob(qreq(), { workerId: 'sweeper' })
    const r3 = (await db.motionStudioAgentJob.findUnique({ where: { id: j2.id } }))!
    // legacy null waitingStartedAt row never expires
    const j3 = await job('ws_l', p2, { status: 'needs_input', waitingStartedAt: null, updatedAt: new Date(Date.now() - 48 * 3600_000) })
    await claimProducerJob(qreq(), { workerId: 'sweeper' })
    const r4 = (await db.motionStudioAgentJob.findUnique({ where: { id: j3.id } }))!
    console.log('F', { unchanged: r1.waitingStartedAt!.getTime() === start.getTime(), statusBefore: r1.status, late, after: r2.status, sweep: r3.status, nullWaitStatus: r4.status })
    expect(r1.waitingStartedAt!.getTime()).toBe(start.getTime()); expect(r2.status).toBe('failed'); expect(r3.status).toBe('failed')
  })
})

describe('g) checkpoint validation', () => {
  it('runs', async () => {
    pull(false)
    const p = await project('ws_m'); const j = await job('ws_m', p, { status: 'running' })
    let rev = 1
    const save = (cp: unknown) => msg(bridge.botSaveCheckpoint(j.id, breq(j.token), { revision: rev++, checkpoint: cp }))
    const out = {
      tokenKey: await save({ jobToken: 'abc' }), nestedSecret: await save({ a: [{ b: { apiKey: 'x' } }] }),
      signedUrl: await save({ media: 'https://bucket.s3.amazonaws.com/x.mp4?X-Amz-Signature=abc' }),
      s3: await save({ m: 's3://bucket/k' }), wsPath: await save({ m: 'ws/ws_m/motion-studio/agent/x.mp4' }),
      bearer: await save({ h: 'Bearer abcdef' }), valid: await save({ stage: 'visuals', manifestAssetIds: ['asset_1'] }),
      fpMaxTokens: await save({ stage: 'x', maxTokens: 5 }), fpStoryUrl: await save({ notes: 'Customer site is https://example.com' }),
      fpKeyword: await save({ narrationKeywords: ['a'] }), fpWsWord: await save({ text: 'news/weather' }),
    }
    console.log('G', out)
    for (const k of ['tokenKey','nestedSecret','signedUrl','s3','wsPath','bearer']) expect((out as any)[k]).toMatch(/400/)
    expect(out.valid).toBe('OK')
  })
})
