import 'server-only'
import {createHash,randomBytes,randomUUID} from 'node:crypto'
import {getPrisma} from '@/lib/server/db'
import {MotionStudioError} from '@/lib/server/motion-studio/errors'
import {buildDeterministicProducerJob} from '@/lib/motion-studio/producer-render-job'
import {validatePortableManifest} from '@/lib/motion-studio/portable-contract'
import {portableAssetSession} from '@/lib/server/motion-studio/portable-assets'
import {coordinatorEnabled,requireRegisteredWorker} from '@/lib/server/motion-studio/coordinator'
import {toPrismaJson} from '@/lib/server/clips/prisma-json'

const db=()=>getPrisma()
const sha=(v:string)=>createHash('sha256').update(v).digest('hex')
const plain=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v)
const obj=(v:unknown):Record<string,unknown>=>plain(v)?v:{}
const problem=(m:string,code='CONFLICT',status=409):never=>{
  throw new MotionStudioError(code,m,status)
}
export const PROJECT_RENDER_CAPABILITY='motion-studio-deterministic-render'

async function getCurrentVersion(workspaceId:string,projectId:string,versionId:string){
  const [project,version,latest]=await Promise.all([
    db().motionStudioProject.findFirst({where:{workspaceId,id:projectId},select:{id:true}}),
    db().motionStudioPortableVersion.findFirst({
      where:{id:versionId,workspaceId,projectId,status:'committed'}}),
    db().motionStudioPortableVersion.findFirst({
      where:{workspaceId,projectId,status:'committed'},orderBy:{revision:'desc'},select:{id:true}}),
  ])
  if(!project||!version)problem('Editable project version not found','NOT_FOUND',404)
  if(latest?.id!==version!.id)problem('Project version changed; reload before rendering')
  return version!
}
export async function submitDeterministicJob(workspaceId:string,projectId:string,raw:unknown){
  const input=obj(raw)
  const versionId=typeof input.versionId==='string'?input.versionId:''
  const idempotencyKey=typeof input.idempotencyKey==='string'?input.idempotencyKey.slice(0,120):''
  if(!versionId||!idempotencyKey)problem('Version and idempotency key are required','INVALID',400)
  const prior=await db().motionStudioDeterministicJob.findUnique({
    where:{versionId_idempotencyKey:{versionId,idempotencyKey}},
  })
  if(prior&&prior.workspaceId===workspaceId&&prior.projectId===projectId)return prior
  const version=await getCurrentVersion(workspaceId,projectId,versionId)
  const manifest=validatePortableManifest(version.manifest)
  let jobInput
  try{jobInput=buildDeterministicProducerJob({
    manifest,theme:version.theme,overrides:version.overrides,
    dryRun:input.dryRun===true,
  })}catch(e){problem(e instanceof Error?e.message:'Invalid deterministic edits','INVALID',400)}
  let result
  try{
    result=await db().motionStudioDeterministicJob.create({data:{
      id:'msdj_'+randomUUID(),workspaceId,projectId,versionId,idempotencyKey,
      jobInput:toPrismaJson(jobInput!),status:'queued',
    }})
  }catch(e){
    if((e as {code?:string}).code!=='P2002')throw e
    const existing=await db().motionStudioDeterministicJob.findUnique({
      where:{versionId_idempotencyKey:{versionId,idempotencyKey}},
    })
    if(!existing||existing.workspaceId!==workspaceId||existing.projectId!==projectId)throw e
    return existing
  }
  if(coordinatorEnabled())await coordinateDeterministicJobs(1)
  return result
}
export async function customerDeterministicJob(workspaceId:string,projectId:string,id:string){
  const job=await db().motionStudioDeterministicJob.findFirst({where:{id,workspaceId,projectId}})
  if(!job)problem('Deterministic job not found','NOT_FOUND',404)
  return {id:job!.id,status:job!.status,versionId:job!.versionId,
    publishedVersionId:job!.publishedVersionId,resultAssetId:job!.resultAssetId,
    durationMs:job!.durationMs,error:job!.error,updatedAt:job!.updatedAt}
}
type Reservation={id:string;workerId:string;webhookUrl:string;leaseId:string;versionId:string}
async function reserveOne():Promise<Reservation|null>{
  return db().$transaction(async tx=>{
    // Same lock used by creative and scene jobs: one physical-machine budget.
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(117131771)`
    const now=new Date()
    const jobs=await tx.motionStudioDeterministicJob.findMany({
      where:{status:'queued',attempts:{lt:12}},orderBy:{createdAt:'asc'},take:30})
    if(!jobs.length)return null
    const [workers,machines,activeDeterministic,activeScene,activeCreative]=await Promise.all([
      tx.motionStudioProducerWorker.findMany({where:{enabled:true}}),
      tx.motionStudioWorkerMachine.findMany({where:{enabled:true}}),
      tx.motionStudioDeterministicJob.findMany({where:{status:{in:['reserved','running']},
        leaseExpiresAt:{gt:now}},select:{workerId:true}}),
      tx.motionStudioRenderRequest.findMany({where:{status:{in:['reserved','running']},
        leaseExpiresAt:{gt:now}},select:{workerId:true}}),
      tx.motionStudioWorkerAssignment.findMany({where:{status:{in:['reserved','dispatched','running']},
        leaseExpiresAt:{gt:now}},select:{workerId:true}}),
    ])
    const machinesById=new Map(machines.map(m=>[m.id,m]))
    const usedWorker=new Map<string,number>(),usedMachine=new Map<string,number>()
    for(const assigned of [...activeDeterministic,...activeScene,...activeCreative]){
      if(!assigned.workerId)continue
      const worker=workers.find(w=>w.id===assigned.workerId)
      if(!worker)continue
      usedWorker.set(worker.id,(usedWorker.get(worker.id)||0)+1)
      usedMachine.set(worker.machineId,(usedMachine.get(worker.machineId)||0)+1)
    }
    for(const job of jobs){
      const version=await tx.motionStudioPortableVersion.findFirst({
        where:{id:job.versionId,projectId:job.projectId,workspaceId:job.workspaceId,status:'committed'},
        select:{manifest:true},
      })
      if(!version)continue
      let sceneEngines:string[]=[]
      try{
        const manifest=validatePortableManifest(version.manifest)
        if(!manifest.producerDocument)continue
        sceneEngines=[...new Set(manifest.scenes.map(s=>s.engine))]
      }catch{continue}
      const available=workers.filter(w=>{
        const machine=machinesById.get(w.machineId)
        const capabilities=Array.isArray(w.capabilities)?w.capabilities:[]
        return machine && capabilities.includes(PROJECT_RENDER_CAPABILITY) &&
          sceneEngines.every(e=>capabilities.includes('render:'+e)||
            capabilities.includes('motion-studio-all-engines')) &&
          (usedWorker.get(w.id)||0)<w.maxConcurrent &&
          (usedMachine.get(w.machineId)||0)<machine.maxRenders
      }).sort((a,b)=>(usedWorker.get(a.id)||0)-(usedWorker.get(b.id)||0))
      const worker=available[0]
      if(!worker)continue
      const leaseId=randomBytes(32).toString('base64url')
      const changed=await tx.motionStudioDeterministicJob.updateMany({
        where:{id:job.id,status:'queued'},data:{status:'reserved',workerId:worker.id,
          leaseHash:sha(job.id+':'+leaseId),
          leaseExpiresAt:new Date(Date.now()+5*60_000),attempts:{increment:1}},
      })
      if(changed.count)return {id:job.id,workerId:worker.id,webhookUrl:worker.webhookUrl,
        leaseId,versionId:job.versionId}
    }
    return null
  },{timeout:15000})
}
/** The server wakes a producer using the existing webhook; no bot polling, no AI calls. */
export async function coordinateDeterministicJobs(limit=3){
  if(!coordinatorEnabled())return {enabled:false,dispatched:0}
  const secret=process.env.MOTION_STUDIO_COORDINATOR_WEBHOOK_KEY||''
  const url=process.env.MOTION_STUDIO_AGENT_PUBLIC_URL||''
  if(secret.length<32||!url||new URL(url).protocol!=='https:')
    problem('Deterministic coordinator is not configured','INTERNAL',503)
  let dispatched=0,failed=0
  for(let i=0;i<Math.min(10,Math.max(1,limit));i++){
    const job=await reserveOne()
    if(!job)break
    let accepted=false
    try{
      const response=await fetch(job.webhookUrl,{method:'POST',cache:'no-store',
        redirect:'error',signal:AbortSignal.timeout(15000),
        headers:{'Authorization':'Bearer '+secret,'Content-Type':'application/json'},
        body:JSON.stringify({
          action:'motion_studio_deterministic_render',mode:'deterministic_render',
          renderJobId:job.id,workerId:job.workerId,leaseId:job.leaseId,
          versionId:job.versionId,
          jobUrl:new URL('/api/motion-studio/agent/deterministic-jobs/'+encodeURIComponent(job.id),url).toString(),
        }),
      })
      accepted=response.ok
    }catch{/* retry through the durable queue, never start paid work */}
    if(accepted){
      dispatched++
      await db().motionStudioDeterministicJob.updateMany({
        where:{id:job.id,workerId:job.workerId,status:'reserved'},
        data:{status:'running'},
      })
    }else{
      failed++
      await db().motionStudioDeterministicJob.updateMany({
        where:{id:job.id,workerId:job.workerId,status:'reserved'},
        data:{status:'queued',workerId:null,leaseHash:null,leaseExpiresAt:null},
      })
    }
  }
  return {enabled:true,dispatched,failed}
}
export async function workerDeterministicLease(request:Request,id:string,workerId:string,leaseId:string){
  const worker=await requireRegisteredWorker(request,workerId)
  const job=await db().motionStudioDeterministicJob.findFirst({
    where:{id,workerId:worker.id,status:{in:['reserved','running']},
      leaseExpiresAt:{gt:new Date()}},
  })
  if(!job||!job.leaseHash||job.leaseHash!==sha(id+':'+leaseId))
    problem('Deterministic worker lease expired or unauthorized','UNAUTHENTICATED',401)
  return job
}
export async function getWorkerDeterministicJob(request:Request,id:string){
  const query=new URL(request.url).searchParams
  const job=await workerDeterministicLease(request,id,query.get('workerId')||'',query.get('leaseId')||'')
  const version=await db().motionStudioPortableVersion.findFirst({
    where:{id:job.versionId,projectId:job.projectId,workspaceId:job.workspaceId,status:'committed'},
  })
  if(!version)problem('Source version missing','NOT_FOUND',404)
  const manifest=validatePortableManifest(version!.manifest)
  if(!manifest.producerDocument||!manifest.producerAssetMap)
    problem('Job has no native producer source')
  const session=await portableAssetSession(job.workspaceId,job.projectId,version!.id)
  if(session.unavailableAssetIds.length)
    problem('Original source assets are unavailable')
  return {id:job.id,mode:'deterministic_render',status:job.status,
    projectId:job.projectId,versionId:job.versionId,
    input:job.jobInput,producerDocument:manifest.producerDocument,
    producerAssetMap:manifest.producerAssetMap,assetUrls:session.assetUrls,
    theme:version!.theme,overrides:version!.overrides,
  }
}
export async function sweepDeterministicJobs(){
  const now=new Date()
  await db().motionStudioDeterministicJob.updateMany({
    where:{status:'queued',attempts:{gte:12}},
    data:{status:'failed',error:'No compatible deterministic producer accepted this job.'},
  })
  const expired=await db().motionStudioDeterministicJob.updateMany({
    where:{status:{in:['reserved','running']},leaseExpiresAt:{lte:now},attempts:{lt:12}},
    data:{status:'queued',workerId:null,leaseHash:null,leaseExpiresAt:null},
  })
  await db().motionStudioDeterministicJob.updateMany({
    where:{status:{in:['reserved','running']},leaseExpiresAt:{lte:now},attempts:{gte:12}},
    data:{status:'failed',error:'Deterministic worker lease expired.'},
  })
  const dispatched=await coordinateDeterministicJobs()
  return {expired:expired.count,...dispatched}
}
