import 'server-only'

import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto'
import { getPrisma } from '@/lib/server/db'
import { getClipStorage, createReadableSignedUrl, storageDriverName } from '@/lib/storage'
import { toPrismaJson } from '@/lib/server/clips/prisma-json'
import { importAgentTimeline } from '@/lib/server/motion-studio/agent-import'
import type { ClipEditsV2 } from '@/lib/clips/edits'

const prisma = () => getPrisma()
const object = (v: unknown): Record<string, unknown> =>
  v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : {}
const word = (v: unknown, max = 240) => typeof v === 'string' ? v.trim().slice(0, max) : ''
const digest = (value: string) => createHash('sha256').update(value).digest()
const finished = (status: string) => ['complete', 'failed', 'cancelled', 'dispatch_failed'].includes(status)
const MAX_FILE_BYTES = 2_000_000_000
const STAGES = ['selecting', 'editing', 'graphics', 'review', 'rendering', 'delivering', 'complete'] as const
const messages: Record<string,string> = {
  selecting: "We're preparing your highlights…",
  editing: "We're shaping the best moments…",
  graphics: "We're adding motion graphics…",
  review: "We're reviewing the edit…",
  rendering: "We're rendering your finished clip…",
  delivering: "We're adding it to your clips…",
  complete: 'Your finished clip is ready.',
}
const friendly = (raw: unknown, stage: string) => {
  const m = word(raw)
  return !m || /grok|bot\b|model|engine|\/workspace|\/tmp\/|https?:\/\/|token|traceback|ffmpeg|python|stack trace|api[_ -]?key/i.test(m)
    ? messages[stage] ?? "We're finishing your clip…" : m
}
type Artifact = {
  id: string; key: string; filename: string; kind: string; mime: string; bytes: number;
  state: 'pending' | 'ready'; s3UploadId?: string
}
const items = (value: unknown) => Array.isArray(value) ? value as Artifact[] : []
const publicJob = (j: {
  id: string; clipId: string; projectId: string; status: string; phase: string; progress: number;
  message: string | null; createdAt: Date; completedAt: Date | null; durationMs: number | null;
}) => ({
  id:j.id, clipId:j.clipId, projectId:j.projectId, status:j.status,
  phase:j.phase, progress:j.progress, message:friendly(j.message,j.phase),
  durationMs:j.durationMs, createdAt:j.createdAt.toISOString(),
  completedAt:j.completedAt?.toISOString() ?? null,
})
const problem = (message: string, status: number): Error & {status:number} =>
  Object.assign(new Error(message), {status})

export async function listClipAgentFinishes(workspaceId: string, projectId: string) {
  const project = await prisma().clipProject.findFirst({
    where:{id:projectId,workspaceId,deletedAt:null},select:{id:true},
  })
  if (!project) throw problem('Project not found.',404)
  const rows = await prisma().clipAgentFinishJob.findMany({
    where:{workspaceId,projectId},orderBy:{createdAt:'desc'},take:100,
  })
  const latest = new Map<string, typeof rows[number]>()
  for (const j of rows) if (!latest.has(j.clipId)) latest.set(j.clipId,j)
  return await Promise.all([...latest.values()].map(async j => ({
    ...publicJob(j),
    videoUrl:j.resultKey && j.status==='complete'
      ? await createReadableSignedUrl(j.resultKey,3600).catch(()=>null) : null,
  })))
}

function callbackOrigin(request: Request) {
  const raw = process.env.MOTION_STUDIO_AGENT_PUBLIC_URL || new URL(request.url).origin
  const u = new URL(raw)
  const validProd = u.protocol==='https:' && (u.hostname==='transovo.ai'||u.hostname.endsWith('.transovo.ai'))
  const validDev = process.env.NODE_ENV!=='production' && u.protocol==='http:' && ['localhost','127.0.0.1'].includes(u.hostname)
  if (!validProd && !validDev) throw problem('Configure public HTTPS callback origin.',503)
  return u.origin
}

/** Preserve the current clipper moment detection, scores and source footage.
 * This job is enhancement only: dialogue/action must remain truthful and intact.
 */
export async function dispatchClipAgentFinish(workspaceId: string, projectId: string,
  clipId: string, request: Request, idempotencyKey: string) {
  if (!process.env.GROKBOT_WEBHOOK_URL || !process.env.GROKBOT_WEBHOOK_KEY) {
    throw problem('Transovo Agent is not connected yet.',503)
  }
  if (process.env.GROKBOT_LIVE_MODE !== '1') throw problem('Transovo Agent production is not enabled.',503)
  const clip = await prisma().clip.findFirst({
    where:{id:clipId,projectId,workspaceId,deletedAt:null},
    select:{
      id:true,title:true,startMs:true,endMs:true,score:true,segmentKey:true,
      sourceSegKey:true,sourceSegStartMs:true,sourceSegEndMs:true,
      previewKey:true,project:{
        select:{title:true,status:true,upload:{select:{key:true,filename:true,mime:true}}}
      },
    },
  })
  if (!clip) throw problem('Clip not found.',404)
  if (clip.endMs<=clip.startMs) throw problem('Clip has an invalid duration.',409)
  if (clip.project.status!=='READY') throw problem('Finish clip discovery before requesting a production.',409)
  const sourceKey = clip.project.upload?.key || clip.segmentKey || clip.sourceSegKey || clip.previewKey
  if (!sourceKey) throw problem('The original clip footage is unavailable.',409)
  const key = word(idempotencyKey,120) || 'clip-finish-v1'
  const previous = await prisma().clipAgentFinishJob.findUnique({
    where:{clipId_idempotencyKey:{clipId,idempotencyKey:key}},
  })
  if (previous) return publicJob(previous)
  const active = await prisma().clipAgentFinishJob.count({
    where:{workspaceId,status:{in:['dispatching','dispatched','running']}},
  })
  if (active>=6) throw problem('Too many clips are being finished at once.',429)
  const today = new Date();today.setUTCHours(0,0,0,0)
  const daily = await prisma().clipAgentFinishJob.count({where:{workspaceId,createdAt:{gte:today}}})
  if (daily>=30) throw problem('Daily production limit reached.',429)
  const sourceUrl = await createReadableSignedUrl(sourceKey,3600)
  if (!sourceUrl) throw problem('The video cannot be accessed for processing.',409)
  const id = 'caf_'+randomUUID()
  const token = randomBytes(32).toString('base64url')
  const tokenHash = digest(id+':'+token).toString('hex')
  const origin = callbackOrigin(request)
  const root = origin+'/api/clips/agent/jobs/'+encodeURIComponent(id)
  let job
  try {
    job=await prisma().clipAgentFinishJob.create({data:{
      id,clipId,projectId,workspaceId,idempotencyKey:key,tokenHash,
      tokenExpiresAt:new Date(Date.now()+36*3600_000),
      phase:'dispatch',status:'dispatching',message:'Preparing your clip for finishing.',
    }})
  } catch(e) {
    if ((e as {code?:string}).code!=='P2002') throw e
    const duplicate=await prisma().clipAgentFinishJob.findUnique({
      where:{clipId_idempotencyKey:{clipId,idempotencyKey:key}},
    })
    if (!duplicate) throw e
    return publicJob(duplicate)
  }
  // For the original upload, clip timestamps are absolute. An isolated
  // segment/preview is already clip-local and must start at zero.
  const fromOriginal=sourceKey===clip.project.upload?.key
  const startMs=fromOriginal ? clip.startMs : 0
  const endMs=fromOriginal ? clip.endMs : clip.endMs-clip.startMs
  const payload={
    version:1,action:'finish_clip',mode:'source_footage_enhancement',
    jobId:id,projectId,clipId,jobToken:token,jobUrl:root,callbackUrl:root,
    title:clip.title,projectTitle:clip.project.title,
    source:{url:sourceUrl,filename:clip.project.upload?.filename||'source.mp4',
      startMs,endMs,durationMs:Math.max(1,endMs-startMs)},
    durationSeconds:Math.round((clip.endMs-clip.startMs)/1000),
    aspectRatio:'9:16',fps:30,quality:'premium',
    score:clip.score,
    direction:'Find the strongest continuous story in this already-selected moment. Preserve the original voices and footage. Remove dead air or bridge moments only when editorially appropriate; do not invent dialogue or unnecessarily reassemble the story. Compose speaker-aware reframing and dynamic split-screen layouts for 1/2/3+ speakers when useful. Design story-specific kinetic typography, custom motion graphics, captions, transitions, effects and sound polish. The unified director chooses any available engines and may layer them. Preserve voice sync, speech intelligibility and editorial meaning. Produce one finished vertical social clip and project.json with editable layers.',
    mediaPolicy:'user_footage_primary',webResearch:false,
  }
  try {
    const url=new URL(process.env.GROKBOT_WEBHOOK_URL)
    if (url.protocol!=='https:') throw new Error('Webhook must use HTTPS')
    const response=await fetch(url,{method:'POST',cache:'no-store',redirect:'error',
      headers:{Authorization:'Bearer '+process.env.GROKBOT_WEBHOOK_KEY,'Content-Type':'application/json'},
      body:JSON.stringify(payload),signal:AbortSignal.timeout(15000),
    })
    if (!response.ok) throw new Error('Webhook not accepted')
    job=await prisma().clipAgentFinishJob.update({where:{id},data:{
      status:'dispatched',phase:'selecting',message:messages.selecting,
    }})
  }catch(e){
    job=await prisma().clipAgentFinishJob.update({where:{id},data:{
      status:'dispatch_failed',phase:'dispatch',error:'Producer unavailable.',
      message:'We could not start the clip finish. You can retry.',
      completedAt:new Date(),
    }})
    console.error('[clip-agent] dispatch_failed',{jobId:id,error:e instanceof Error?e.name:'unknown'})
  }
  return publicJob(job)
}

export async function authorizeClipAgentCallback(id: string,request: Request) {
  const auth=request.headers.get('authorization')||''
  const token=auth.startsWith('Bearer ')?auth.slice(7):''
  if (!token||token.length>256) throw problem('Job authorization required.',401)
  const job=await prisma().clipAgentFinishJob.findUnique({where:{id}})
  if (!job||job.tokenExpiresAt<=new Date()) throw problem('Invalid or expired job.',401)
  const got=digest(id+':'+token),expected=Buffer.from(job.tokenHash,'hex')
  if (got.length!==expected.length||!timingSafeEqual(got,expected)) throw problem('Invalid job token.',401)
  return job
}

export async function getClipAgentAssignment(id: string,request: Request) {
  const j=await authorizeClipAgentCallback(id,request)
  return {...publicJob(j),mode:'source_footage_enhancement'}
}

export async function updateClipAgentProgress(id: string,request: Request,raw: unknown) {
  const j=await authorizeClipAgentCallback(id,request)
  if (finished(j.status)) throw problem('Job already finished.',409)
  const v=object(raw)
  const stage=word(v.stage||v.phase,40)
  const phase=STAGES.includes(stage as typeof STAGES[number])?stage:'editing'
  const proposed=Number(v.percent??v.progress)
  const progress=Number.isFinite(proposed)?Math.max(j.progress,Math.min(99,Math.round(proposed))):j.progress
  const row=await prisma().clipAgentFinishJob.update({where:{id},data:{
    status:'running',phase,progress,message:friendly(v.message,phase),
  }})
  return publicJob(row)
}

export async function clipAgentArtifact(id: string,request: Request,raw: unknown) {
  const j=await authorizeClipAgentCallback(id,request)
  if (finished(j.status)) throw problem('Job already finished.',409)
  const input=object(raw), action=word(input.action,20)
  const all=items(j.artifacts)
  if (action==='prepare') {
    const filename=word(input.filename,150).replace(/[^A-Za-z0-9._-]/g,'_')
    const kind=word(input.kind,24),mime=word(input.mime,80),bytes=Number(input.bytes)
    if (!filename || !['video','project','media','audio'].includes(kind)
      || !['video/mp4','video/webm','application/json','image/png','image/jpeg','audio/mpeg','audio/wav','audio/mp4'].includes(mime)
      || !Number.isSafeInteger(bytes)||bytes<1||bytes>MAX_FILE_BYTES||all.length>=100) {
      throw problem('Invalid artifact.',400)
    }
    const uploadId=randomUUID()
    const objectKey='ws/'+j.workspaceId+'/clip-agent/'+id+'/'+uploadId+'/'+filename
    const upload=await getClipStorage().createUpload({workspaceId:j.workspaceId,uploadId,
      filename,mime,bytes,objectKey})
    const item:Artifact={id:uploadId,key:objectKey,filename,kind,mime,bytes,state:'pending',
      ...(upload.s3Multipart?{s3UploadId:upload.s3Multipart.uploadId}:{})}
    await prisma().clipAgentFinishJob.update({where:{id},data:{artifacts:toPrismaJson([...all,item])}})
    return {uploadId,objectKey,mode:upload.mode,signedPut:upload.signedPut,
      tus:upload.tus,s3Multipart:upload.s3Multipart}
  }
  if (action==='commit') {
    const item=all.find(a=>a.id===word(input.uploadId,100))
    if (!item) throw problem('Artifact not found.',404)
    if (item.state==='ready') return {uploadId:item.id,status:'ready'}
    const parts=Array.isArray(input.parts)?input.parts.slice(0,1000).map(p=>{
      const x=object(p);return {partNumber:Number(x.partNumber),etag:word(x.etag,256)}
    }):[]
    if (item.s3UploadId && (!parts.length || parts.some(p=>!Number.isSafeInteger(p.partNumber)||p.partNumber<1||!p.etag))) {
      throw problem('Multipart parts required.',400)
    }
    const storage=getClipStorage()
    await storage.completeUpload({objectKey:item.key,s3UploadId:item.s3UploadId,parts})
    const size=await storage.getObjectSizeBytes(item.key)
    if (!size||size>MAX_FILE_BYTES) throw problem('Uploaded artifact missing.',400)
    item.state='ready'
    await prisma().clipAgentFinishJob.update({where:{id},data:{artifacts:toPrismaJson(all)}})
    return {uploadId:item.id,status:'ready',bytes:size}
  }
  throw problem('Expected prepare or commit.',400)
}

export async function completeClipAgentJob(id: string,request: Request,raw: unknown) {
  const job=await authorizeClipAgentCallback(id,request)
  if (job.status==='complete') return publicJob(job)
  if (finished(job.status)) throw problem('Job already finished.',409)
  const body=object(raw)
  if (body.status==='failed') {
    const j=await prisma().clipAgentFinishJob.update({where:{id},data:{
      status:'failed',phase:'failed',message:'Your clip could not be finished. Try again.',
      completedAt:new Date(),error:'Producer reported failure.',
    }})
    return publicJob(j)
  }
  const video=items(job.artifacts).find(a=>a.state==='ready'&&a.kind==='video'&&a.mime==='video/mp4')
  if (!video) throw problem('Upload and commit a finished MP4 first.',409)
  const durationMs=Number(body.durationMs)
  if (!Number.isSafeInteger(durationMs)||durationMs<1000||durationMs>600_000) {
    throw problem('Invalid output duration.',400)
  }
  const now=new Date()
  // Build editable layers from the returned manifest before the short DB commit.
  // If no manifest is supplied, the original clip stays editable and the
  // enhanced master is still saved as the finished preview/download.
  const existing=await prisma().clip.findFirst({where:{
    id:job.clipId,projectId:job.projectId,workspaceId:job.workspaceId,deletedAt:null,
  },select:{edits:true}})
  if (!existing) throw problem('Source clip was removed.',404)
  const base=existing.edits as unknown as ClipEditsV2
  let imported:ClipEditsV2|null=null
  if (items(job.artifacts).some(a=>a.filename==='project.json'&&a.state==='ready')) {
    try {
      imported=await importAgentTimeline({
        workspaceId:job.workspaceId,motionProjectId:job.clipId,clipProjectId:job.projectId,
        durationMs,base,directArtifacts:items(job.artifacts),
      })
      // Clip-finishing must not silence the original dialogue even when
      // the manifest contains separately uploaded effects or stems.
      if (imported) imported={...imported,
        audioMuteRanges:base.audioMuteRanges,
        audio:{...base.audio,sfx:[...(base.audio?.sfx??[]),...(imported.audio?.sfx??[])]},
      }
    }catch(err){
      console.warn('[clip-agent] editable_manifest_fallback',{
        jobId:id,error:err instanceof Error?err.name:'unknown',
      })
    }
  }
  const result=await prisma().$transaction(async tx=>{
    const clip=await tx.clip.findFirst({where:{
      id:job.clipId,projectId:job.projectId,workspaceId:job.workspaceId,deletedAt:null,
    },select:{id:true,aiMeta:true,previewKey:true,edits:true,editsSaveVersion:true}})
    if (!clip) throw problem('Source clip was removed.',404)
    const meta=object(clip.aiMeta)
    const prior=Array.isArray(meta.agentFinishedVersions)?meta.agentFinishedVersions as unknown[]:[]
    const versions=[...prior,{
      jobId:id,key:video.key,durationMs,completedAt:now.toISOString(),
    }].slice(-20)
    await tx.clip.update({where:{id:clip.id},data:{
      previewKey:video.key,storageDriver:storageDriverName(),
      ...(imported?{edits:toPrismaJson(imported),editsSaveVersion:{increment:1}}:{}),
      aiMeta:toPrismaJson({...meta,agentFinishOriginalPreviewKey:
        meta.agentFinishOriginalPreviewKey||clip.previewKey||null,
        agentFinishedVersions:versions,agentFinishActiveJobId:id,
        agentFinishEditableLayersImported:Boolean(imported)}),
    }})
    // The original editable clip timeline is deliberately preserved. This output
    // is an enhanced master preview/download, never destructive replacement.
    return tx.clipAgentFinishJob.update({where:{id},data:{
      status:'complete',phase:'complete',progress:100,message:messages.complete,
      resultKey:video.key,durationMs,completedAt:now,
    }})
  })
  return publicJob(result)
}

export function clipAgentError(err: unknown) {
  const status=typeof (err as {status?:unknown})?.status==='number'
    ? (err as {status:number}).status : 500
  if(status===500) console.error('[clip-agent] server_error',{kind:err instanceof Error?err.name:'unknown'})
  return Response.json({error:status===500?'Clip finishing is temporarily unavailable.':
    err instanceof Error?err.message:'Invalid request.'},{status})
}
