import 'server-only'
import { randomUUID,createHash } from 'node:crypto'
import { getPrisma } from '@/lib/server/db'
import { getClipStorage, createReadableSignedUrl } from '@/lib/storage'
import { MotionStudioError } from '@/lib/server/motion-studio/errors'
import { requireRegisteredWorker } from '@/lib/server/motion-studio/coordinator'
import { toPrismaJson } from '@/lib/server/clips/prisma-json'
const db=()=>getPrisma()
type Upload={id:string;key:string;filename:string;mime:string;bytes:number;
  state:'pending'|'ready';s3UploadId?:string}
const obj=(v:unknown):Record<string,unknown>=>v&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,unknown>:{}
function fail(m:string,s=400): never {throw new MotionStudioError('INVALID',m,s)}
const sha=(v:string)=>createHash('sha256').update(v).digest('hex')
async function lease(request:Request,id:string,input:Record<string,unknown>){
  const workerId=String(input.workerId||'')
  const worker=await requireRegisteredWorker(request,workerId)
  const row=await db().motionStudioRenderRequest.findFirst({
    where:{id,workerId:worker.id,status:{in:['reserved','running']},leaseExpiresAt:{gt:new Date()}},
  })
  if(!row||!row.leaseHash||row.leaseHash!==sha(id+':'+String(input.leaseId||'')))
    fail('Render assignment has expired or belongs to another worker.',409)
  return row!
}
export async function renderUploadAction(request:Request,id:string,raw:unknown){
  const input=obj(raw)
  const row=await lease(request,id,input)
  const action=input.action
  const existing=obj(row.upload) as Partial<Upload>
  if(action==='prepare'){
    if(existing.id&&existing.key&&existing.state){
      return{uploadId:existing.id,alreadyPrepared:true,status:existing.state}
    }
    const filename=typeof input.filename==='string'?input.filename.replace(/[^a-zA-Z0-9._-]/g,'_').slice(0,140):''
    const mime=String(input.mime||'')
    const bytes=Number(input.bytes)
    if(!filename||!['video/mp4','image/png','image/jpeg','image/webp'].includes(mime)||
      !Number.isSafeInteger(bytes)||bytes<1||bytes>1024*1024*1024)
      fail('Invalid deterministic render output.')
    const uploadId=randomUUID()
    const key='ws/'+row.workspaceId+'/motion-studio/renders/'+row.id+'/'+uploadId+'/'+filename
    const upload=await getClipStorage().createUpload({
      workspaceId:row.workspaceId,uploadId,filename,mime,bytes,objectKey:key,
    })
    const metadata:Upload={id:uploadId,key,filename,mime,bytes,state:'pending',
      ...(upload.s3Multipart?{s3UploadId:upload.s3Multipart.uploadId}:{})}
    const updated=await db().motionStudioRenderRequest.updateMany({
      where:{id,workerId:row.workerId,status:{in:['reserved','running']}},
      data:{upload:toPrismaJson(metadata)},
    })
    if(!updated.count)fail('Render assignment changed.',409)
    return{uploadId,mode:upload.mode,signedPut:upload.signedPut,
      tus:upload.tus,s3Multipart:upload.s3Multipart}
  }
  if(action==='commit'){
    if(!existing.id||!existing.key||!existing.filename||!existing.mime||!existing.bytes)
      fail('Prepare the render output first.',409)
    if(existing.state==='ready')return{uploadId:existing.id,status:'ready'}
    const parts=Array.isArray(input.parts)?input.parts.slice(0,1000).map(v=>{
      const p=obj(v);return{partNumber:Number(p.partNumber),etag:String(p.etag||'').slice(0,256)}
    }):[]
    if(existing.s3UploadId&&(!parts.length||parts.some(p=>!Number.isInteger(p.partNumber)||p.partNumber<1||!p.etag)))
      fail('Valid multipart ETags required.')
    const storage=getClipStorage()
    await storage.completeUpload({objectKey:existing.key,s3UploadId:existing.s3UploadId,parts})
    const size=await storage.getObjectSizeBytes(existing.key)
    if(!size||size>existing.bytes)fail('Uploaded render output is missing or larger than declared.',409)
    await db().studioAsset.upsert({where:{id:existing.id},
      create:{id:existing.id,projectId:row.projectId,workspaceId:row.workspaceId,
        uploadId:existing.id,kind:existing.mime.startsWith('video/')?'video':'image',
        filename:existing.filename,status:'ready',
        provenanceLog:toPrismaJson({source:'deterministic_scene_render',renderRequestId:id})},
      update:{status:'ready'},
    })
    await db().motionStudioRenderRequest.updateMany({
      where:{id,workerId:row.workerId},data:{upload:toPrismaJson({...existing,state:'ready'})},
    })
    return{uploadId:existing.id,status:'ready',bytes:size}
  }
  fail('Expected prepare or commit.')
}
export async function getCustomerRenderOutput(workspaceId:string,projectId:string,id:string){
  const row=await db().motionStudioRenderRequest.findFirst({
    where:{id,workspaceId,projectId},
  })
  if(!row)fail('Render request not found.',404)
  const upload=obj(row!.upload)
  const url=row!.status==='complete'&&upload.state==='ready'&&typeof upload.key==='string'
    ?await createReadableSignedUrl(upload.key,900).catch(()=>null):null
  return{render:{id:row!.id,status:row!.status,sceneId:row!.sceneId,
    versionId:row!.versionId,resultAssetId:row!.resultAssetId,error:row!.error,
    updatedAt:row!.updatedAt,url}}
}
