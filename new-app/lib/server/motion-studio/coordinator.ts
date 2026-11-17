import 'server-only'
import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto'
import { getPrisma } from '@/lib/server/db'
import { MotionStudioError } from '@/lib/server/motion-studio/errors'
import { toPrismaJson } from '@/lib/server/clips/prisma-json'
const db = () => getPrisma()
const hash = (s: string) => createHash('sha256').update(s).digest('hex')
const eq = (a: string, b: string) => {
  const x = Buffer.from(hash(a), 'hex'), y = Buffer.from(hash(b), 'hex')
  return timingSafeEqual(x,y)
}
const matchesStoredHash = (given:string,stored:string) =>
  /^[a-f0-9]{64}$/i.test(stored) &&
  timingSafeEqual(Buffer.from(hash(given),'hex'),Buffer.from(stored,'hex'))
const uid = (v: unknown) => typeof v === 'string' && /^[a-zA-Z0-9_.:-]{3,96}$/.test(v)
const obj = (x: unknown): Record<string, unknown> =>
  x && typeof x === 'object' && !Array.isArray(x) ? x as Record<string,unknown> : {}
const problem = (text: string, code = 'INVALID', status = 400): never => {
  throw new MotionStudioError(code, text, status)
}
export const coordinatorEnabled = () => process.env.MOTION_STUDIO_COORDINATOR === '1'
export function requireCoordinatorAdmin(request: Request) {
  const key = process.env.MOTION_STUDIO_COORDINATOR_ADMIN_KEY || ''
  const auth = request.headers.get('authorization') || ''
  if (key.length < 32 || !auth.startsWith('Bearer ') || !eq(auth.slice(7), key))
    problem('Coordinator administrator credential required.', 'UNAUTHENTICATED', 401)
}
function safeWebhook(raw: string) {
  const url = new URL(raw)
  if (url.protocol !== 'https:' || url.username || url.password || !url.hostname)
    problem('Worker webhook must be HTTPS.')
  if (url.hostname === 'localhost' || /^(?:127\.|10\.|192\.168\.|169\.254\.)/.test(url.hostname) ||
      /^(?:172\.(?:1[6-9]|2\d|3[01])\.)/.test(url.hostname))
    problem('Private or local webhook addresses are not allowed.')
  return url.toString()
}
export async function registerMachine(request: Request, raw: unknown) {
  requireCoordinatorAdmin(request)
  const x = obj(raw)
  if (!uid(x.id) || typeof x.name !== 'string' || x.name.length > 120 ||
      !Number.isInteger(x.maxRenders) || Number(x.maxRenders) < 1 || Number(x.maxRenders) > 16)
    problem('Invalid machine configuration')
  return db().motionStudioWorkerMachine.upsert({
    where: { id: x.id as string },
    create: { id: x.id as string, name: x.name, maxRenders: x.maxRenders as number },
    update: { name: x.name, maxRenders: x.maxRenders as number, enabled: x.enabled !== false },
  })
}
export async function registerPlan(request: Request, raw: unknown) {
  requireCoordinatorAdmin(request)
  const x = obj(raw)
  if (!uid(x.id) || typeof x.name !== 'string' || x.name.length > 120 ||
      !Number.isInteger(x.maxConcurrentAi) || Number(x.maxConcurrentAi) < 1 || Number(x.maxConcurrentAi) > 16 ||
      !Number.isFinite(x.weeklyLimitPercent) || Number(x.weeklyLimitPercent) <= 0 ||
      Number(x.weeklyLimitPercent) > 100)
    problem('Invalid plan configuration')
  return db().motionStudioWorkerPlan.upsert({
    where: { id: x.id as string },
    create: { id: x.id as string, name: x.name, maxConcurrentAi: x.maxConcurrentAi as number,
      weeklyLimitPercent: x.weeklyLimitPercent as number },
    update: { name: x.name, maxConcurrentAi: x.maxConcurrentAi as number,
      weeklyLimitPercent: x.weeklyLimitPercent as number, enabled: x.enabled !== false },
  })
}
export async function registerWorker(request: Request, raw: unknown) {
  requireCoordinatorAdmin(request)
  const x = obj(raw)
  if (!uid(x.id) || !uid(x.machineId) || !uid(x.planId) ||
      typeof x.name !== 'string' || x.name.length > 120 ||
      typeof x.webhookUrl !== 'string' ||
      !Number.isInteger(x.maxConcurrent) || Number(x.maxConcurrent) < 1 || Number(x.maxConcurrent) > 8 ||
      !Array.isArray(x.capabilities) || x.capabilities.length > 80 ||
      x.capabilities.some(c=>!uid(c)))
    problem('Invalid worker configuration')
  const [machine,plan] = await Promise.all([
    db().motionStudioWorkerMachine.findUnique({ where: { id:x.machineId as string } }),
    db().motionStudioWorkerPlan.findUnique({ where: { id:x.planId as string } }),
  ])
  if (!machine || !plan) problem('Create the machine and plan before its workers')
  const credential = randomBytes(32).toString('base64url')
  const worker = await db().motionStudioProducerWorker.upsert({
    where: { id:x.id as string },
    create: { id:x.id as string, name:x.name, machineId:x.machineId as string,
      planId:x.planId as string, webhookUrl:safeWebhook(x.webhookUrl),
      credentialHash:hash(credential), capabilities: toPrismaJson(x.capabilities),
      maxConcurrent:x.maxConcurrent as number },
    update: { name:x.name, machineId:x.machineId as string, planId:x.planId as string,
      webhookUrl:safeWebhook(x.webhookUrl), credentialHash:hash(credential),
      capabilities:toPrismaJson(x.capabilities), maxConcurrent:x.maxConcurrent as number,
      enabled:x.enabled !== false },
  })
  // Credential is returned once; only a hash is persisted.
  return { worker: { id:worker.id, machineId:worker.machineId, planId:worker.planId }, credential }
}
export async function requireRegisteredWorker(request: Request, id: string) {
  const worker = await db().motionStudioProducerWorker.findUnique({ where: { id } })
  const auth = request.headers.get('authorization') || ''
  if (!worker || !worker.enabled || !auth.startsWith('Bearer ') ||
      !matchesStoredHash(auth.slice(7), worker.credentialHash))
    problem('Valid worker credential required.', 'UNAUTHENTICATED', 401)
  return worker!
}
function availableBudget(plan: {observedPercent: number|null; observedAt:Date|null; resetsAt:Date|null;
 weeklyLimitPercent:number}) {
  if (plan.resetsAt && plan.resetsAt.getTime() <= Date.now()) return true
  if (plan.observedPercent === null) return true // no observation yet; honor reservations
  // Don't treat an old low observation as a promise of available credits.
  if (!plan.observedAt || Date.now()-plan.observedAt.getTime()>48*3600_000) return false
  return plan.observedPercent < plan.weeklyLimitPercent
}
type Pending = {jobId:string;workspaceId:string;projectId:string;userId:string;
 workerId:string;machineId:string;planId:string;webhookUrl:string;lease:string;token:string}
/**
 * Serialized scheduler; no worker polling and no dedicated dispatch computer.
 * Invoked on job submission, worker completion and an authenticated server cron.
 */
async function reserveOne(): Promise<Pending|null> {
  return db().$transaction(async tx => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(117131771)`
    const now = new Date()
    const active = await tx.motionStudioWorkerAssignment.findMany({
      where:{ status:{ in:['reserved','dispatched','running'] }, leaseExpiresAt:{ gt:now } },
    })
    const workerCounts = new Map<string,number>(), machineCounts = new Map<string,number>(),
      planCounts = new Map<string,number>(), workspaceCounts = new Map<string,number>()
    for (const a of active) {
      workerCounts.set(a.workerId,(workerCounts.get(a.workerId)||0)+1)
      machineCounts.set(a.machineId,(machineCounts.get(a.machineId)||0)+1)
      planCounts.set(a.planId,(planCounts.get(a.planId)||0)+1)
      workspaceCounts.set(a.workspaceId,(workspaceCounts.get(a.workspaceId)||0)+1)
    }
    const globalMax = Math.max(1,Math.min(100,Number(process.env.MOTION_STUDIO_MAX_ACTIVE_JOBS)||8))
    if (active.length >= globalMax) return null
    const workspacesMax = Math.max(1,Math.min(8,Number(process.env.MOTION_STUDIO_MAX_JOBS_PER_WORKSPACE)||1))
    const workers = await tx.motionStudioProducerWorker.findMany({ where:{ enabled:true }, orderBy:{ id:'asc' } })
    // A deterministic scene render and a creative AI job consume the same
    // physical machine even though only the latter consumes Grok plan usage.
    const activeRenders = await tx.motionStudioRenderRequest.findMany({
      where:{ status:{in:['reserved','running']}, leaseExpiresAt:{gt:now},workerId:{not:null} },
      select:{workerId:true},
    })
    for(const render of activeRenders){
      if(!render.workerId)continue
      const renderer=workers.find(w=>w.id===render.workerId)
      if(!renderer)continue
      workerCounts.set(renderer.id,(workerCounts.get(renderer.id)||0)+1)
      machineCounts.set(renderer.machineId,(machineCounts.get(renderer.machineId)||0)+1)
    }
    const machines = await tx.motionStudioWorkerMachine.findMany({ where:{ enabled:true } })
    const plans = await tx.motionStudioWorkerPlan.findMany({ where:{ enabled:true } })
    const machinesById = new Map(machines.map(m=>[m.id,m]))
    const plansById = new Map(plans.map(p=>[p.id,p]))
    const jobs = await tx.motionStudioAgentJob.findMany({
      where:{ status:'queued', leaseAttempts:{ lt:20 } }, orderBy:[{ createdAt:'asc' }],take:50,
    })
    for (const job of jobs) {
      if ((workspaceCounts.get(job.workspaceId)||0)>=workspacesMax) continue
      const latestSource=await tx.motionStudioPortableVersion.findFirst({
        where:{projectId:job.projectId,workspaceId:job.workspaceId,status:'committed'},
        orderBy:{revision:'desc'},select:{manifest:true},
      })
      const scenes=latestSource?.manifest&&typeof latestSource.manifest==='object'?
        (latestSource.manifest as unknown as {scenes?:unknown}).scenes:null
      const requiredEngines=Array.isArray(scenes)?Array.from(new Set(scenes.map(x=>
        x&&typeof x==='object'?(x as {engine?:unknown}).engine:null
      ).filter((x):x is string=>typeof x==='string'))):[]
      const viable = workers.filter(w=>{
        const machine=machinesById.get(w.machineId),plan=plansById.get(w.planId)
        const capabilities=Array.isArray(w.capabilities)?w.capabilities:[]
        return machine && plan && availableBudget(plan) &&
          capabilities.includes('motion-studio-produce') &&
          requiredEngines.every(engine=>capabilities.includes('render:'+engine) ||
            capabilities.includes('motion-studio-all-engines')) &&
          (plan.observedPercent===null || plan.resetsAt && plan.resetsAt.getTime()<=Date.now() ||
            plan.observedPercent + ((planCounts.get(w.planId)||0)+1)*
              Math.max(0.1,Math.min(10,Number(process.env.MOTION_STUDIO_AI_RESERVE_PERCENT)||2)) <= plan.weeklyLimitPercent) &&
          (workerCounts.get(w.id)||0)<w.maxConcurrent &&
          (machineCounts.get(w.machineId)||0)<machine.maxRenders &&
          (planCounts.get(w.planId)||0)<plan.maxConcurrentAi
      }).sort((a,b) => (workerCounts.get(a.id)||0)-(workerCounts.get(b.id)||0) ||
        (machineCounts.get(a.machineId)||0)-(machineCounts.get(b.machineId)||0))
      const selected=viable[0]
      if (!selected) continue
      const lease=randomBytes(32).toString('base64url')
      const token=randomBytes(32).toString('base64url')
      const expires=new Date(Date.now()+5*60_000)
      await tx.motionStudioWorkerAssignment.upsert({
        where:{ jobId:job.id },
        create:{ id:'mswa_'+randomUUID(),jobId:job.id,workspaceId:job.workspaceId,
          workerId:selected.id,machineId:selected.machineId,planId:selected.planId,
          leaseSecretHash:hash(job.id+':'+lease),leaseExpiresAt:expires,status:'reserved' },
        update:{ workerId:selected.id,machineId:selected.machineId,planId:selected.planId,
          leaseSecretHash:hash(job.id+':'+lease),leaseExpiresAt:expires,status:'reserved',
          usageBefore:null,usageAfter:null,usageObservedAt:null },
      })
      await tx.motionStudioAgentJob.update({ where:{ id:job.id },data:{
        status:'dispatched',phase:'accepted',leaseOwner:selected.id,
        leaseIdHash:hash(job.id+':'+lease),leaseExpiresAt:expires,leaseAttempts:{increment:1},
        tokenHash:hash(job.id+':'+token),tokenExpiresAt:new Date(Date.now()+36*3600_000),
      } })
      return {jobId:job.id,workspaceId:job.workspaceId,projectId:job.projectId,userId:job.userId,
        workerId:selected.id,machineId:selected.machineId,planId:selected.planId,
        webhookUrl:selected.webhookUrl,lease,token}
    }
    return null
  },{timeout:15000})
}
export async function coordinatePendingJobs(max = 3) {
  if (!coordinatorEnabled()) return { enabled:false, dispatched:0 }
  // Preserve legacy setup-mode safety: never wake AI production unless explicitly enabled.
  if (process.env.GROKBOT_LIVE_MODE !== '1') return {enabled:true,dispatched:0,setupMode:true}
  const root=process.env.MOTION_STUDIO_AGENT_PUBLIC_URL
  const secret=process.env.MOTION_STUDIO_COORDINATOR_WEBHOOK_KEY || ''
  if (!root || secret.length<32) problem('Coordinator webhook configuration missing','INTERNAL',503)
  const base=new URL(root)
  if (base.protocol!=='https:') problem('Agent public URL must use HTTPS','INTERNAL',503)
  let dispatched=0,failed=0
  for (let i=0;i<Math.max(1,Math.min(max,20));i++) {
    const item=await reserveOne()
    if (!item) break
    let accepted=false
    try {
      const resp=await fetch(item.webhookUrl,{
        method:'POST',cache:'no-store',redirect:'error',signal:AbortSignal.timeout(15000),
        headers:{Authorization:'Bearer '+secret,'Content-Type':'application/json'},
        body:JSON.stringify({action:'motion_studio_job',jobId:item.jobId,
          workspaceId:item.workspaceId,projectId:item.projectId,
          jobUrl:base.origin+'/api/motion-studio/agent/jobs/'+encodeURIComponent(item.jobId),
          jobToken:item.token,leaseId:item.lease,workerId:item.workerId,
          coordinator:true}),
      })
      accepted=resp.ok
    } catch { /* The lease is released below. */ }
    if (!accepted) {
      failed++
      await db().$transaction(async tx=>{
        await tx.motionStudioWorkerAssignment.updateMany({where:{jobId:item.jobId,workerId:item.workerId,status:'reserved'},data:{status:'failed'}})
        await tx.motionStudioAgentJob.updateMany({where:{id:item.jobId,leaseOwner:item.workerId,status:'dispatched'},
          data:{status:'queued',leaseOwner:null,leaseIdHash:null,leaseExpiresAt:null}})
      })
      continue
    }
    dispatched++
    await db().motionStudioWorkerAssignment.updateMany({
      where:{jobId:item.jobId,workerId:item.workerId,status:'reserved'},data:{status:'dispatched'},
    })
  }
  return { enabled:true,dispatched,failed }
}
export async function reportWorkerProgress(request: Request, raw: unknown) {
  const input=obj(raw), id=String(input.workerId||'')
  const worker=await requireRegisteredWorker(request,id)
  const jobId=String(input.jobId||'')
  const lease=String(input.leaseId||'')
  const assignment=await db().motionStudioWorkerAssignment.findFirst({
    where:{jobId,workerId:worker.id,status:{in:['reserved','dispatched','running']}},
  })
  if (!assignment || assignment.leaseExpiresAt.getTime()<=Date.now() ||
      !eq(hash(jobId+':'+lease),assignment.leaseSecretHash))
    problem('Worker lease not owned or expired','CONFLICT',409)
  const status=input.status==='complete'?'complete':input.status==='failed'?'failed':'running'
  const observed=Number(input.weeklyUsagePercent)
  const validObservation=input.weeklyUsagePercent!==undefined &&
    Number.isFinite(observed)&&observed>=0&&observed<=100
  const usageMoment=input.usageMoment==='before'?'before':'after'
  const observedAt=typeof input.observedAt==='string'?new Date(input.observedAt):new Date()
  if(validObservation && (!Number.isFinite(observedAt.getTime()) ||
      observedAt.getTime()>Date.now()+60_000 ||
      observedAt.getTime()<Date.now()-7*24*3600_000))
    problem('Invalid Grok plan usage observation timestamp')
  const expires=new Date(Date.now()+5*60_000)
  await db().$transaction(async tx=>{
    await tx.motionStudioWorkerAssignment.update({
      where:{id:assignment.id},data:{
        status,leaseExpiresAt:status==='running'?expires:new Date(),
        ...(validObservation?{...(usageMoment==='before'?{usageBefore:observed}:{usageAfter:observed}),
          usageObservedAt:observedAt}:{}),
      },
    })
    if (validObservation) {
      // The timestamp predicate is atomic: two bots sharing a plan must not
      // overwrite a newer reading with a delayed, older usage observation.
      await tx.motionStudioWorkerPlan.updateMany({where:{
        id:assignment.planId,
        OR:[{observedAt:null},{observedAt:{lt:observedAt}}],
      },data:{observedPercent:observed,observedAt}})
    }
    if(status==='running') await tx.motionStudioAgentJob.updateMany({where:{id:jobId,leaseOwner:worker.id},
      data:{leaseExpiresAt:expires}})
  })
  if(status!=='running') await coordinatePendingJobs(1)
  return {ok:true,status,leaseExpiresAt:expires.toISOString()}
}
export async function coordinatorSweep() {
  if (!coordinatorEnabled()) return { enabled:false }
  const now=new Date()
  const deadline=new Date(Date.now()-24*3600_000)
  const staleQuestions=await db().motionStudioAgentJob.updateMany({where:{
    status:'needs_input',OR:[
      {waitingStartedAt:{lte:deadline}},
      {waitingStartedAt:null,updatedAt:{lte:deadline}},
    ],
  },data:{status:'failed',phase:'failed',completedAt:now,
    message:'We did not receive your answer within 24 hours.',
    leaseOwner:null,leaseIdHash:null,leaseExpiresAt:null,
  }})
  const abandoned=await db().motionStudioAgentJob.updateMany({where:{
    status:'queued',leaseAttempts:{gte:20},
  },data:{status:'failed',phase:'failed',completedAt:now,
    message:'Production could not be resumed after repeated worker interruptions.',
  }})
  const expired=await db().motionStudioWorkerAssignment.findMany({where:{
    status:{in:['reserved','dispatched','running']},leaseExpiresAt:{lte:now},
  },take:100})
  for (const assignment of expired) {
    await db().$transaction(async tx=>{
      await tx.motionStudioWorkerAssignment.updateMany({where:{
        id:assignment.id,status:{in:['reserved','dispatched','running']},leaseExpiresAt:{lte:now}},
        data:{status:'expired'},
      })
      await tx.motionStudioAgentJob.updateMany({where:{
        id:assignment.jobId,leaseOwner:assignment.workerId,
        status:{in:['dispatched','running']},leaseExpiresAt:{lte:now}},
        data:{status:'queued',leaseOwner:null,leaseIdHash:null,leaseExpiresAt:null},
      })
    })
  }
  const dispatched=await coordinatePendingJobs()
  return { ...dispatched,expired:expired.length,staleQuestions:staleQuestions.count,abandoned:abandoned.count }
}
