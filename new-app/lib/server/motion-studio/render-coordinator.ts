import 'server-only'
import { createHash,randomBytes } from 'node:crypto'
import { getPrisma } from '@/lib/server/db'
import { createReadableSignedUrl } from '@/lib/storage'
import { MotionStudioError } from '@/lib/server/motion-studio/errors'
import { coordinatorEnabled,requireRegisteredWorker } from '@/lib/server/motion-studio/coordinator'
import { validatePortableManifest } from '@/lib/motion-studio/portable-contract'
const db=()=>getPrisma()
const hash=(v:string)=>createHash('sha256').update(v).digest('hex')
const error=(message:string,status=409):never=>{throw new MotionStudioError('CONFLICT',message,status)}
type Reserved={id:string;workerId:string;webhookUrl:string;lease:string;sceneId:string;versionId:string}
async function reserveOneRender():Promise<Reserved|null> {
  return db().$transaction(async tx=>{
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(117131771)`
    const now=new Date()
    const active=await tx.motionStudioRenderRequest.findMany({
      where:{status:{in:['reserved','running']},leaseExpiresAt:{gt:now}},
      select:{workerId:true},
    })
    const activeAi=await tx.motionStudioWorkerAssignment.findMany({
      where:{status:{in:['reserved','dispatched','running']},leaseExpiresAt:{gt:now}},
      select:{workerId:true,machineId:true},
    })
    const workers=await tx.motionStudioProducerWorker.findMany({where:{enabled:true}})
    const machines=await tx.motionStudioWorkerMachine.findMany({where:{enabled:true}})
    const machineById=new Map(machines.map(m=>[m.id,m]))
    const byWorker=new Map<string,number>(),byMachine=new Map<string,number>()
    for(const a of active){
      if(!a.workerId)continue
      byWorker.set(a.workerId,(byWorker.get(a.workerId)||0)+1)
      const w=workers.find(x=>x.id===a.workerId)
      if(w)byMachine.set(w.machineId,(byMachine.get(w.machineId)||0)+1)
    }
    for(const a of activeAi){
      byWorker.set(a.workerId,(byWorker.get(a.workerId)||0)+1)
      byMachine.set(a.machineId,(byMachine.get(a.machineId)||0)+1)
    }
    const renderMax=Math.max(1,Math.min(50,Number(process.env.MOTION_STUDIO_MAX_ACTIVE_RENDERS)||4))
    if(active.length>=renderMax)return null
    const pending=await tx.motionStudioRenderRequest.findMany({
      where:{status:'queued',attempts:{lt:15}},orderBy:{createdAt:'asc'},take:30,
    })
    for(const request of pending){
      const version=await tx.motionStudioPortableVersion.findFirst({
        where:{id:request.versionId,projectId:request.projectId,workspaceId:request.workspaceId,status:'committed'},
        select:{manifest:true},
      })
      if(!version)continue
      let manifest
      try{manifest=validatePortableManifest(version.manifest)}catch{continue}
      const scene=manifest.scenes.find(s=>s.id===request.sceneId)
      if(!scene)continue
      const compatible=workers.filter(w=>{
        const machine=machineById.get(w.machineId)
        const caps=Array.isArray(w.capabilities)?w.capabilities:[]
        return machine&&(caps.includes('motion-studio-render')||caps.includes('render:'+scene.engine))&&
          (byWorker.get(w.id)||0)<w.maxConcurrent&&
          (byMachine.get(w.machineId)||0)<machine.maxRenders
      }).sort((a,b)=>(byWorker.get(a.id)||0)-(byWorker.get(b.id)||0))
      const worker=compatible[0]
      if(!worker)continue
      const lease=randomBytes(32).toString('base64url')
      const changed=await tx.motionStudioRenderRequest.updateMany({
        where:{id:request.id,status:'queued'},data:{
          status:'reserved',workerId:worker.id,leaseHash:hash(request.id+':'+lease),
          leaseExpiresAt:new Date(Date.now()+5*60_000),attempts:{increment:1},
        },
      })
      if(!changed.count)continue
      return {id:request.id,workerId:worker.id,webhookUrl:worker.webhookUrl,
        lease,sceneId:request.sceneId,versionId:request.versionId}
    }
    return null
  },{timeout:15000})
}
/** Server calls the existing idle-cost-free webhook. AI is never invoked. */
export async function coordinateSceneRenders(limit=3){
  if(!coordinatorEnabled())return {enabled:false,dispatched:0}
  const secret=process.env.MOTION_STUDIO_COORDINATOR_WEBHOOK_KEY||''
  const publicUrl=process.env.MOTION_STUDIO_AGENT_PUBLIC_URL||''
  if(secret.length<32||!publicUrl)error('Coordinator is not configured',503)
  const base=new URL(publicUrl)
  if(base.protocol!=='https:')error('Public URL must use HTTPS',503)
  let dispatched=0,failed=0
  for(let i=0;i<Math.max(1,Math.min(10,limit));i++){
    const r=await reserveOneRender()
    if(!r)break
    let ok=false
    try{
      const response=await fetch(r.webhookUrl,{method:'POST',cache:'no-store',redirect:'error',
        signal:AbortSignal.timeout(15000),headers:{
          Authorization:'Bearer '+secret,'Content-Type':'application/json'},
        body:JSON.stringify({action:'motion_studio_render',renderRequestId:r.id,
          sceneId:r.sceneId,versionId:r.versionId,workerId:r.workerId,
          leaseId:r.lease,
          requestUrl:base.origin+'/api/motion-studio/agent/scene-renders/'+encodeURIComponent(r.id)}),
      })
      ok=response.ok
    }catch{ /* Release and retry on next server dispatch. */ }
    if(!ok){
      failed++
      await db().motionStudioRenderRequest.updateMany({
        where:{id:r.id,workerId:r.workerId,status:'reserved'},
        data:{status:'queued',workerId:null,leaseHash:null,leaseExpiresAt:null},
      })
    }else{
      dispatched++
      await db().motionStudioRenderRequest.updateMany({
        where:{id:r.id,workerId:r.workerId,status:'reserved'},data:{status:'running'},
      })
    }
  }
  return{enabled:true,dispatched,failed}
}
export async function getWorkerSceneRender(request:Request,id:string){
  const workerId=new URL(request.url).searchParams.get('workerId')||''
  const worker=await requireRegisteredWorker(request,workerId)
  const render=await db().motionStudioRenderRequest.findFirst({
    where:{id,workerId:worker.id,status:{in:['reserved','running']},leaseExpiresAt:{gt:new Date()}},
  })
  if(!render)error('No active render assignment',404)
  const version=await db().motionStudioPortableVersion.findFirst({
    where:{id:render!.versionId,projectId:render!.projectId,workspaceId:render!.workspaceId},
  })
  if(!version)error('Project version missing',404)
  const manifest=validatePortableManifest(version!.manifest)
  const jobs=await db().motionStudioAgentJob.findMany({
    where:{workspaceId:render!.workspaceId,projectId:render!.projectId},
    select:{artifacts:true},
  })
  const artifacts=jobs.flatMap(job=>Array.isArray(job.artifacts)?job.artifacts:[])
    .filter((v):v is {id:string;key:string;state:string}=>{
      const x=v as {id?:unknown;key?:unknown;state?:unknown}|null
      return !!x&&typeof x.id==='string'&&typeof x.key==='string'&&x.state==='ready'
    })
  const urls:Record<string,string>={}
  for(const entry of manifest.assets){
    const asset=artifacts.find(a=>a.id===entry.id)
    if(!asset)continue
    const url=await createReadableSignedUrl(asset.key,900).catch(()=>null)
    if(url)urls[entry.id]=url
  }
  if(!urls[manifest.scenes.find(s=>s.id===render!.sceneId)!.bundleAssetId])
    error('Scene bundle has no signed download',409)
  return{renderRequestId:render!.id,workspaceId:render!.workspaceId,
    projectId:render!.projectId,versionId:version!.id,sceneId:render!.sceneId,
    patch:render!.patch,manifest,theme:version!.theme,overrides:version!.overrides,
    assetUrls:urls}
}
export async function reportSceneRender(request:Request,id:string,raw:unknown){
  const obj=raw&&typeof raw==='object'?raw as Record<string,unknown>:{}
  const worker=await requireRegisteredWorker(request,String(obj.workerId||''))
  const lease=String(obj.leaseId||'')
  const old=await db().motionStudioRenderRequest.findFirst({
    where:{id,workerId:worker.id,status:{in:['reserved','running']}},
  })
  if(!old||!old.leaseHash||old.leaseHash!==hash(id+':'+lease)||
    !old.leaseExpiresAt||old.leaseExpiresAt.getTime()<=Date.now())
    error('Render lease expired or owned by another worker',409)
  const status=obj.status==='complete'?'complete':obj.status==='failed'?'failed':'running'
  let resultAssetId:string|null=null
  if(status==='complete'){
    resultAssetId=String(obj.resultAssetId||'')
    const ownUpload=old!.upload && typeof old!.upload==='object' && !Array.isArray(old!.upload)
      ?old!.upload as Record<string,unknown>:{}
    if(ownUpload.id!==resultAssetId || ownUpload.state!=='ready')
      error('Only the completed output upload for this render may be published')
    const asset=await db().studioAsset.findFirst({where:{
      id:resultAssetId,workspaceId:old!.workspaceId,projectId:old!.projectId,status:'ready',
    }})
    if(!asset)error('Rendered result asset is not registered in this project')
  }
  const updated=await db().motionStudioRenderRequest.updateMany({
    where:{id,workerId:worker.id,status:{in:['reserved','running']},
      leaseExpiresAt:{gt:new Date()}},
    data:{status,leaseExpiresAt:status==='running'?new Date(Date.now()+5*60_000):new Date(),
      ...(resultAssetId?{resultAssetId}:{}),
      ...(status==='failed'?{error:String(obj.error||'Render failed').slice(0,600)}:{})},
  })
  if(!updated.count)error('Render lease changed')
  if(status!=='running')await coordinateSceneRenders(1)
  return{ok:true,status}
}
export async function sweepSceneRenders(){
  const abandoned=await db().motionStudioRenderRequest.updateMany({
    where:{status:'queued',attempts:{gte:15}},
    data:{status:'failed',error:'No compatible worker could complete this render.'},
  })
  const expired=await db().motionStudioRenderRequest.updateMany({
    where:{status:{in:['reserved','running']},leaseExpiresAt:{lte:new Date()},attempts:{lt:15}},
    data:{status:'queued',workerId:null,leaseHash:null,leaseExpiresAt:null},
  })
  await db().motionStudioRenderRequest.updateMany({
    where:{status:{in:['reserved','running']},leaseExpiresAt:{lte:new Date()},attempts:{gte:15}},
    data:{status:'failed',error:'No compatible worker could complete this render.'},
  })
  const scheduled=await coordinateSceneRenders()
  return{expired:expired.count,abandoned:abandoned.count,...scheduled}
}
