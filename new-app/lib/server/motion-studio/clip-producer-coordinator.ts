import 'server-only'
import {createHash,randomBytes,randomUUID} from 'node:crypto'
import {getPrisma} from '@/lib/server/db'
import {coordinatorEnabled,COORDINATOR_TX} from '@/lib/server/motion-studio/coordinator'

const db=()=>getPrisma()
const hash=(v:string)=>createHash('sha256').update(v).digest('hex')
const active=['reserved','dispatched','running']
export const CLIP_LEASE_MS=15*60_000
const CLIP_MAX_RUNTIME_MS=6*60*60_000
/** Size-aware runtime cap, rather than a fixed 45 minutes for a 15-clip / 2-hour source. */
const clipRuntimeMs=(clips:number,sourceMs:number)=>Math.min(CLIP_MAX_RUNTIME_MS,
  45*60_000 + Math.max(1,Math.min(15,clips))*15*60_000 +
  Math.min(90*60_000,Math.round(Math.max(0,sourceMs)/3)))
const CLIP_DISPATCH_BACKOFF_MS=60_000
export const clipProducerConfigReady=()=>{
  const url=process.env.MOTION_STUDIO_AGENT_PUBLIC_URL||''
  try{return process.env.MOTION_STUDIO_COORDINATOR==='1' &&
    process.env.GROKBOT_LIVE_MODE==='1' &&
    (process.env.MOTION_STUDIO_COORDINATOR_WEBHOOK_KEY||'').length>=32 &&
    new URL(url).protocol==='https:'}catch{return false}
}
type Reservation={id:string;projectId:string;workspaceId:string;clipId:string;
  workerId:string;webhookUrl:string;token:string;lease:string}
export const clipProducerEnabled=()=>process.env.CLIPS_PRODUCER_PIPELINE==='1'

/** All creative coordinators serialize on the existing advisory lock and assignments. */
async function reserveClipJob():Promise<Reservation|null>{
  return db().$transaction(async tx=>{
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(117131771)`
    const now=new Date()
    const jobs=await tx.clipAgentFinishJob.findMany({
      where:{status:'queued',attempts:{lt:2}},orderBy:{createdAt:'asc'},take:30,
    })
    if(!jobs.length)return null
    const [workers,machines,plans,assignments,renders,deterministic]=await Promise.all([
      tx.motionStudioProducerWorker.findMany({where:{enabled:true}}),
      tx.motionStudioWorkerMachine.findMany({where:{enabled:true}}),
      tx.motionStudioWorkerPlan.findMany({where:{enabled:true}}),
      tx.motionStudioWorkerAssignment.findMany({where:{status:{in:active},leaseExpiresAt:{gt:now}}}),
      tx.motionStudioRenderRequest.findMany({where:{status:{in:['reserved','running']},leaseExpiresAt:{gt:now}},select:{workerId:true}}),
      tx.motionStudioDeterministicJob.findMany({where:{status:{in:['reserved','running']},leaseExpiresAt:{gt:now}},select:{workerId:true}}),
    ])
    const byMachine=new Map(machines.map(m=>[m.id,m]))
    const byPlan=new Map(plans.map(p=>[p.id,p]))
    const workerUsed=new Map<string,number>(),machineUsed=new Map<string,number>(),planUsed=new Map<string,number>()
    for(const a of assignments){
      workerUsed.set(a.workerId,(workerUsed.get(a.workerId)||0)+1)
      machineUsed.set(a.machineId,(machineUsed.get(a.machineId)||0)+1)
      planUsed.set(a.planId,(planUsed.get(a.planId)||0)+1)
    }
    for(const render of [...renders,...deterministic]){
      const worker=workers.find(w=>w.id===render.workerId)
      if(worker){
        workerUsed.set(worker.id,(workerUsed.get(worker.id)||0)+1)
        machineUsed.set(worker.machineId,(machineUsed.get(worker.machineId)||0)+1)
      }
    }
    const globalMax=Math.max(1,Math.min(100,Number(process.env.MOTION_STUDIO_MAX_ACTIVE_JOBS)||8))
    if(assignments.length>=globalMax)return null
    for(const job of jobs){
      if(job.attempts>0 && job.updatedAt.getTime()>now.getTime()-CLIP_DISPATCH_BACKOFF_MS)continue
      const available=workers.filter(w=>{
        const caps=Array.isArray(w.capabilities)?w.capabilities:[]
        const machine=byMachine.get(w.machineId),plan=byPlan.get(w.planId)
        if(!machine||!plan||!(caps.includes('clips-produce')||caps.includes('motion-studio-produce')))
          return false
        const usedPercent=plan.resetsAt&&plan.resetsAt<=now?0:(plan.observedPercent||0)
        const reservePercent=Math.max(.1,Math.min(10,Number(process.env.MOTION_STUDIO_AI_RESERVE_PERCENT)||2))
        return usedPercent+((planUsed.get(plan.id)||0)+1)*reservePercent<=plan.weeklyLimitPercent &&
          (workerUsed.get(w.id)||0)<w.maxConcurrent &&
          (machineUsed.get(machine.id)||0)<machine.maxRenders &&
          (planUsed.get(plan.id)||0)<plan.maxConcurrentAi
      }).sort((a,b)=>(workerUsed.get(a.id)||0)-(workerUsed.get(b.id)||0))
      const worker=available[0]
      if(!worker)continue
      const lease=randomBytes(32).toString('base64url')
      const token=randomBytes(32).toString('base64url')
      const expires=new Date(Date.now()+CLIP_LEASE_MS)
      await tx.motionStudioWorkerAssignment.upsert({
        where:{jobId:job.id},
        create:{id:'mswa_'+randomUUID(),jobId:job.id,workspaceId:job.workspaceId,
          workerId:worker.id,machineId:worker.machineId,planId:worker.planId,
          leaseSecretHash:hash(job.id+':'+lease),leaseExpiresAt:expires,status:'reserved'},
        update:{workerId:worker.id,machineId:worker.machineId,planId:worker.planId,
          leaseSecretHash:hash(job.id+':'+lease),leaseExpiresAt:expires,status:'reserved',
          usageBefore:null,usageAfter:null,usageObservedAt:null},
      })
      await tx.clipAgentFinishJob.update({where:{id:job.id},data:{
        status:'dispatching',workerId:worker.id,leaseHash:hash(job.id+':'+lease),
        leaseExpiresAt:expires,attempts:{increment:1},
        tokenHash:hash(job.id+':'+token),tokenExpiresAt:new Date(Date.now()+36*3600_000),
        startedAt:job.startedAt||now,
      }})
      return {id:job.id,projectId:job.projectId,workspaceId:job.workspaceId,
        clipId:job.clipId,workerId:worker.id,webhookUrl:worker.webhookUrl,lease,token}
    }
    return null
  },COORDINATOR_TX)
}

export async function coordinateClipJobs(limit=3){
  if(!clipProducerEnabled()||!coordinatorEnabled())return {enabled:false,dispatched:0}
  if(process.env.GROKBOT_LIVE_MODE!=='1')return {enabled:true,dispatched:0,setupMode:true}
  if(!clipProducerConfigReady())return {enabled:true,dispatched:0,error:'clip_coordinator_not_configured'}
  const root=process.env.MOTION_STUDIO_AGENT_PUBLIC_URL!
  const secret=process.env.MOTION_STUDIO_COORDINATOR_WEBHOOK_KEY!
  let dispatched=0,failed=0
  for(let i=0;i<Math.max(1,Math.min(10,limit));i++){
    const job=await reserveClipJob()
    if(!job)break
    let accepted=false
    try{
      const response=await fetch(job.webhookUrl,{method:'POST',cache:'no-store',
        redirect:'error',signal:AbortSignal.timeout(15000),
        headers:{Authorization:'Bearer '+secret,'Content-Type':'application/json'},
        body:JSON.stringify({action:job.clipId.startsWith('project:')?'clip_and_finish':'finish_clip',
          kind:job.clipId.startsWith('project:')?'clips':'clip_revision',
          jobId:job.id,jobUrl:new URL('/api/clips/agent/jobs/'+encodeURIComponent(job.id),root).toString(),
          jobToken:job.token,projectId:job.projectId,clipId:job.clipId,
          workspaceId:job.workspaceId,workerId:job.workerId,leaseId:job.lease,
          coordinator:true,delivery:{mode:'mp4'}}),
      })
      accepted=response.ok
    }catch{/* bounded retry from sweep */}
    if(accepted){
      dispatched++
      await db().$transaction([
        db().clipAgentFinishJob.updateMany({where:{id:job.id,workerId:job.workerId,status:'dispatching'},
          data:{status:'dispatched',phase:'selecting',message:'Finding your best moments.'}}),
        db().motionStudioWorkerAssignment.updateMany({where:{jobId:job.id,workerId:job.workerId,status:'reserved'},
          data:{status:'dispatched'}}),
      ])
    }else{
      failed++
      const fresh=await db().clipAgentFinishJob.findUnique({where:{id:job.id},select:{attempts:true}})
      const exhausted=(fresh?.attempts||0)>=2
      await db().$transaction([
        db().clipAgentFinishJob.updateMany({where:{id:job.id,workerId:job.workerId,status:'dispatching'},
          data:{status:exhausted?'failed':'queued',workerId:null,leaseHash:null,leaseExpiresAt:null,
            ...(exhausted?{phase:'failed',error:'Producer dispatch failed twice.',failReason:'dispatch failed',
              completedAt:new Date(),message:'We could not start production. Please retry.'}:
              {message:'Waiting to retry producer dispatch.'})}}),
        db().motionStudioWorkerAssignment.updateMany({where:{jobId:job.id,workerId:job.workerId,status:'reserved'},
          data:{status:'failed'}}),
      ])
      console.error('[clip-agent] coordinator_dispatch_failed',{jobId:job.id})
    }
  }
  return {enabled:true,dispatched,failed}
}

export async function renewClipLease(id:string,workerId:string,leaseExpiresAt:Date|null){
  if(!clipProducerEnabled()||!workerId||!leaseExpiresAt)return
  if(leaseExpiresAt.getTime()-Date.now()>CLIP_LEASE_MS-5*60_000)return
  const now=new Date()
  const until=new Date(Date.now()+CLIP_LEASE_MS)
  await db().$transaction([
    db().clipAgentFinishJob.updateMany({where:{id,workerId,status:{in:['dispatching','dispatched','running']},
      leaseExpiresAt:{gt:now}},data:{leaseExpiresAt:until}}),
    db().motionStudioWorkerAssignment.updateMany({where:{jobId:id,workerId,status:{in:active},
      leaseExpiresAt:{gt:now}},data:{leaseExpiresAt:until,status:'running'}}),
  ])
}
export async function closeClipLease(id:string,ok:boolean){
  if(!clipProducerEnabled())return
  await db().motionStudioWorkerAssignment.updateMany({where:{jobId:id,status:{in:active}},
    data:{status:ok?'complete':'failed',leaseExpiresAt:new Date()}})
}
export async function sweepClipJobs(){
  if(!clipProducerEnabled()||!coordinatorEnabled())return {enabled:false}
  const now=new Date()
  const stale=await db().clipAgentFinishJob.findMany({where:{
    status:{in:['queued','dispatching','dispatched','running']},
    OR:[{startedAt:{lte:new Date(now.getTime()-45*60_000)}},{leaseExpiresAt:{lte:now}}],
  },take:100})
  let retried=0,failed=0,partial=0
  for(const job of stale){
    await db().$transaction(async tx=>{
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(117131771)`
      const fresh=await tx.clipAgentFinishJob.findUnique({where:{id:job.id}})
      if(!fresh||!['queued','dispatching','dispatched','running'].includes(fresh.status))return
      const project=await tx.clipProject.findUnique({where:{id:fresh.projectId},
        select:{settings:true,upload:{select:{durationMs:true}}}})
      const settings=(project?.settings&&typeof project.settings==='object'&&!Array.isArray(project.settings))
        ?project.settings as Record<string,unknown>:{}
      const expected=Number(settings.autoGrokMaxClips)||5
      const deadline=fresh.startedAt
        ?new Date(fresh.startedAt.getTime()+clipRuntimeMs(expected,project?.upload?.durationMs||0)):null
      const timedOut=Boolean(deadline&&deadline<=now)
      const lostLease=Boolean(fresh.leaseExpiresAt&&fresh.leaseExpiresAt<=now)
      if(!timedOut&&!lostLease)return
      const published=await tx.clip.findMany({where:{workspaceId:fresh.workspaceId,
        projectId:fresh.projectId,deletedAt:null},select:{aiMeta:true}})
      const count=published.filter(c=>{
        const m=c.aiMeta
        return m&&typeof m==='object'&&!Array.isArray(m)&&
          (m as Record<string,unknown>).agentClipperRunId===fresh.id
      }).length
      await tx.motionStudioWorkerAssignment.updateMany({where:{jobId:fresh.id,status:{in:active}},
        data:{status:'expired',leaseExpiresAt:now}})
      // Once the webhook accepted paid work there is no automatic retry.
      const retryPreAccept=fresh.status==='queued'&&fresh.attempts<2&&count===0
      await tx.clipAgentFinishJob.update({where:{id:fresh.id},data:count>0?{
        status:'complete',phase:'complete',progress:100,
        message:count+' clips ready (partial production; remaining clips were not completed).',
        completedAt:now,workerId:null,leaseHash:null,leaseExpiresAt:null,
      }:retryPreAccept?{
        status:'queued',phase:'dispatch',message:'Retrying producer dispatch.',
        workerId:null,leaseHash:null,leaseExpiresAt:null,startedAt:null,
      }:{
        status:'failed',phase:'failed',message:'Clip production timed out. Please retry manually.',
        error:timedOut?'runtime cap exceeded':'lease expired',
        failReason:timedOut?'runtime cap exceeded':'lease expired',
        completedAt:now,workerId:null,leaseHash:null,leaseExpiresAt:null,
      }})
      if(count)partial++;else if(retryPreAccept)retried++;else failed++
    },COORDINATOR_TX)
  }
  const dispatched=await coordinateClipJobs()
  return {...dispatched,retried,failed,partial}
}
