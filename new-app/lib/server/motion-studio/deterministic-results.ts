import 'server-only'
import {createHash,randomUUID} from 'node:crypto'
import {getPrisma} from '@/lib/server/db'
import {getClipStorage,storageDriverName} from '@/lib/storage'
import {MotionStudioError} from '@/lib/server/motion-studio/errors'
import {toPrismaJson} from '@/lib/server/clips/prisma-json'
import {workerDeterministicLease,coordinateDeterministicJobs} from '@/lib/server/motion-studio/deterministic-jobs'
import {publishPortableVersion} from '@/lib/server/motion-studio/portable-projects'
import {validateNativeProducerEnvelope,type ProducerAssetRecord,type ProducerSceneBundle} from '@/lib/motion-studio/producer-project-adapter'

const db=()=>getPrisma()
const obj=(v:unknown):Record<string,unknown>=>v&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,unknown>:{}
function bad(m:string,s=409): never {throw new MotionStudioError('CONFLICT',m,s)}
const sha=(v:Buffer)=>createHash('sha256').update(v).digest('hex')
type SourceUpload={id:string;key:string;filename:string;kind:string;mime:string;bytes:number;
  state:'pending'|'ready';sha256?:string;s3UploadId?:string}
const sourceUploads=(value:unknown):SourceUpload[]=>
  Array.isArray(value)?value as SourceUpload[]:[]
const finished=(s:string)=>['complete','failed','cancelled'].includes(s)

export async function deterministicAssetAction(request:Request,id:string,raw:unknown){
  const input=obj(raw),workerId=String(input.workerId||''),leaseId=String(input.leaseId||'')
  const job=await workerDeterministicLease(request,id,workerId,leaseId)
  const existing=sourceUploads(job.upload)
  if(input.action==='prepare'){
    if(existing.length>=500)bad('Too many producer output files',400)
    const filename=typeof input.filename==='string'?input.filename.replace(/[^a-zA-Z0-9._-]/g,'_').slice(0,140):''
    const mime=String(input.mime||''),kind=String(input.kind||'')
    const bytes=Number(input.bytes),checksum=String(input.sha256||'').toLowerCase()
    if(!filename||!['video/mp4','video/quicktime','image/png','image/jpeg',
      'image/webp','image/svg+xml','application/zip','application/json','text/plain',
      'font/ttf','font/otf','font/woff','font/woff2','text/javascript','application/javascript',
      'application/wasm','text/css','audio/mp4','audio/wav'].includes(mime)||
      !['video','media','image','font','bundle','project','audio'].includes(kind)||
      !Number.isSafeInteger(bytes)||bytes<1||bytes>2_000_000_000||
      (checksum&&!/^[a-f0-9]{64}$/.test(checksum))||
      (['font','image','bundle'].includes(kind)&&(!checksum||bytes>25*1024*1024)))
      bad('Invalid or unsigned source output metadata',400)
    const uploadId=randomUUID()
    const key='ws/'+job.workspaceId+'/motion-studio/deterministic/'+id+'/'+uploadId+'/'+filename
    const upload=await getClipStorage().createUpload({workspaceId:job.workspaceId,
      uploadId,filename,mime,bytes,objectKey:key})
    const source:SourceUpload={id:uploadId,key,filename,kind,mime,bytes,state:'pending',
      ...(checksum?{sha256:checksum}:{}),
      ...(upload.s3Multipart?{s3UploadId:upload.s3Multipart.uploadId}:{})}
    // Lock the durable job row to prevent concurrent scene uploads from
    // overwriting each other's metadata array.
    await db().$transaction(async tx=>{
      await tx.$queryRaw`SELECT "id" FROM "MotionStudioDeterministicJob" WHERE "id" = ${id} FOR UPDATE`
      const current=await tx.motionStudioDeterministicJob.findUniqueOrThrow({where:{id}})
      if(current.workerId!==workerId||finished(current.status))bad('Worker assignment changed')
      const uploads=sourceUploads(current.upload)
      await tx.motionStudioDeterministicJob.update({where:{id},
        data:{upload:toPrismaJson([...uploads,source])}})
    })
    return {uploadId,mode:upload.mode,signedPut:upload.signedPut,
      tus:upload.tus,s3Multipart:upload.s3Multipart}
  }
  if(input.action==='commit'){
    const uploadId=String(input.uploadId||'')
    const original=existing.find(v=>v.id===uploadId)
    if(!original)bad('Output upload was not prepared',404)
    if(original.state==='ready')return {uploadId,status:'ready',bytes:original.bytes}
    const parts=Array.isArray(input.parts)?input.parts.slice(0,1000).map(x=>{
      const part=obj(x);return{partNumber:Number(part.partNumber),etag:String(part.etag||'').slice(0,256)}
    }):[]
    if(original.s3UploadId&&(!parts.length||parts.some(p=>!Number.isInteger(p.partNumber)||p.partNumber<1||!p.etag)))
      bad('Multipart upload requires valid ETags',400)
    const storage=getClipStorage()
    await storage.completeUpload({objectKey:original.key,s3UploadId:original.s3UploadId,parts})
    const actualBytes=await storage.getObjectSizeBytes(original.key)
    if(actualBytes!==original.bytes)bad('Output file size does not match declared bytes')
    if(original.sha256){
      let computed:string
      if(actualBytes<=25*1024*1024){
        computed=sha(await storage.getObjectBytes(original.key))
      }else{
        const url=await storage.createSignedDownloadUrl(original.key,900)
        const response=await fetch(url,{redirect:'error',cache:'no-store'})
        if(!response.ok||!response.body)bad('Unable to verify rendered media')
        const hash=createHash('sha256')
        const reader=response.body.getReader()
        let count=0
        try{
          for(;;){
            const {value,done}=await reader.read()
            if(done)break
            count+=value.byteLength
            if(count>original.bytes)bad('Uploaded media grew during verification')
            hash.update(value)
          }
        }finally{await reader.cancel()}
        if(count!==original.bytes)bad('Incomplete media during verification')
        computed=hash.digest('hex')
      }
      if(computed!==original.sha256)bad('Output SHA-256 mismatch',422)
    }
    // Register a native upload record so the shared portable asset resolver
    // can mint short-lived URLs without relying on an AI job artifact array.
    await db().clipUpload.upsert({where:{id:original.id},
      create:{id:original.id,workspaceId:job.workspaceId,key:original.key,
        filename:original.filename,bytes:BigInt(original.bytes),mime:original.mime,
        kind:'media',status:'COMPLETE',storageDriver:storageDriverName()},
      update:{},
    })
    await db().studioAsset.upsert({where:{id:original.id},
      create:{id:original.id,projectId:job.projectId,workspaceId:job.workspaceId,
        uploadId:original.id,kind:original.kind,filename:original.filename,status:'ready',
        ...(original.sha256?{provenanceLog:toPrismaJson({
          source:'deterministic_render',renderJobId:id,
          sha256:original.sha256,verifiedSha256:true})}:{})},
      update:{status:'ready',
        ...(original.sha256?{provenanceLog:toPrismaJson({
          source:'deterministic_render',renderJobId:id,
          sha256:original.sha256,verifiedSha256:true})}:{})},
    })
    await db().$transaction(async tx=>{
      await tx.$queryRaw`SELECT "id" FROM "MotionStudioDeterministicJob" WHERE "id" = ${id} FOR UPDATE`
      const current=await tx.motionStudioDeterministicJob.findUniqueOrThrow({where:{id}})
      const uploads=sourceUploads(current.upload)
      const index=uploads.findIndex(v=>v.id===uploadId)
      if(index<0)bad('Output upload metadata changed')
      uploads[index]={...uploads[index]!,state:'ready'}
      await tx.motionStudioDeterministicJob.update({where:{id},
        data:{upload:toPrismaJson(uploads)}})
    })
    return {uploadId,status:'ready',bytes:actualBytes}
  }
  bad('Expected prepare or commit',400)
}

export async function reportDeterministicJob(request:Request,id:string,raw:unknown){
  const input=obj(raw)
  const job=await workerDeterministicLease(request,id,
    String(input.workerId||''),String(input.leaseId||''))
  if(input.status==='running'){
    await db().motionStudioDeterministicJob.updateMany({
      where:{id,status:{in:['reserved','running']},workerId:job.workerId},
      data:{status:'running',leaseExpiresAt:new Date(Date.now()+5*60_000)},
    })
    return{ok:true,status:'running'}
  }
  if(input.status==='failed'){
    await db().motionStudioDeterministicJob.updateMany({
      where:{id,status:{in:['reserved','running']},workerId:job.workerId},
      data:{status:'failed',leaseExpiresAt:new Date(),
        error:String(input.error||'Deterministic render failed').slice(0,600)},
    })
    await coordinateDeterministicJobs(1)
    return{ok:true,status:'failed'}
  }
  if(input.status!=='complete')bad('Unknown deterministic worker status',400)
  const source=await db().motionStudioPortableVersion.findFirst({
    where:{id:job.versionId,workspaceId:job.workspaceId,projectId:job.projectId,status:'committed'},
  })
  if(!source)bad('Original version no longer exists')
  const oldManifest=obj(source!.manifest)
  const original=validateNativeProducerEnvelope(oldManifest.producerDocument)
  const document=validateNativeProducerEnvelope(input.document)
  if(document.projectId!==job.projectId || document.version!==original.version+1 ||
      document.parentVersion!==original.version)
    bad('Worker result must advance the original producer version by exactly one')
  const durationMs=Number(input.durationMs)
  if(!Number.isSafeInteger(durationMs)||durationMs<=0||durationMs>2_147_483_647)
    bad('A valid final master duration is required',400)
  const assets=input.assets as ProducerAssetRecord[]
  const bundles=input.bundles as ProducerSceneBundle[]
  if(!Array.isArray(assets)||!Array.isArray(bundles))bad('Worker must publish complete source metadata')
  const master=assets.find(a=>a.id===document.master.asset)
  if(!master||typeof master.storageId!=='string')bad('Master asset alias missing')
  const ready=sourceUploads(job.upload).find(v=>v.id===master.storageId&&
    v.state==='ready'&&v.mime==='video/mp4')
  if(!ready)bad('The new complete master must be uploaded by this render job')
  // Do not mutate the previous source version. Reuse its original content
  // hashes/aliases and publish a new native document as the next version.
  const version=await publishPortableVersion(job.workspaceId,job.projectId,{
    document,assets,bundles,sourceJobId:id,expectedBaseVersionId:job.versionId,
    // Export produces an MP4 artifact, not a flattened replacement timeline.
    // The next immutable version must remain browser-playable and editable.
    ...(oldManifest.liveProject?{liveProject:oldManifest.liveProject}:{}),
  })
  const target=await db().motionStudioProject.findFirst({
    where:{workspaceId:job.workspaceId,id:job.projectId},
    select:{clipProjectId:true,exportInfo:true},
  })
  if(!target)bad('Project was deleted before rendering')
  await db().$transaction(async tx=>{
    await tx.$queryRaw`SELECT "id" FROM "MotionStudioProject" WHERE "id" = ${job.projectId} FOR UPDATE`
    const current=await tx.motionStudioDeterministicJob.findUniqueOrThrow({where:{id}})
    if(current.status==='complete')return
    const head=await tx.motionStudioPortableVersion.findFirst({
      where:{projectId:job.projectId,workspaceId:job.workspaceId,status:'committed'},
      orderBy:{revision:'desc'},select:{id:true},
    })
    if(head?.id!==version.id)
      bad('The editable project changed before the final master was attached; do not overwrite customer work.')
    const exported=obj(target.exportInfo)
    await tx.motionStudioProject.update({where:{id:job.projectId},data:{
      timelineVersion:{increment:1},status:'review',stage:'review',
      exportInfo:toPrismaJson({...exported,masterKey:ready.key,smallKey:ready.key,
        durationMs,source:'deterministic_render',storageDriver:storageDriverName(),
        deterministicJobId:id}),
    }})
    if(target.clipProjectId && !exported.editorBaseKey){
      const project=await tx.clipProject.findUnique({
        where:{id:target.clipProjectId},select:{uploadId:true},
      })
      if(project?.uploadId)await tx.clipUpload.update({where:{id:project.uploadId},
        data:{key:ready.key,bytes:BigInt(ready.bytes),mime:'video/mp4',
          filename:ready.filename,durationMs,status:'READY',
          storageDriver:storageDriverName()}})
      await tx.clipProject.update({where:{id:target.clipProjectId},data:{
        status:'READY',stage:'motion_studio',progress:100,
        rangeEndMs:durationMs,proxyKey:ready.key,
      }})
    }
    await tx.motionStudioDeterministicJob.update({where:{id},data:{
      status:'complete',leaseExpiresAt:new Date(),
      resultAssetId:ready.id,publishedVersionId:version.id,durationMs,
    }})
  })
  await coordinateDeterministicJobs(1)
  return {ok:true,status:'complete',publishedVersionId:version.id,masterAssetId:ready.id}
}
