import 'server-only'

import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto'
import { getPrisma } from '@/lib/server/db'
import { getClipStorage, createReadableSignedUrl, storageDriverName } from '@/lib/storage'
import { toPrismaJson } from '@/lib/server/clips/prisma-json'
import { importAgentTimeline } from '@/lib/server/motion-studio/agent-import'
import { registerProjectMedia } from '@/lib/server/clips/project-media'
import { normalizeEdits, type ClipEditsV2 } from '@/lib/clips/edits'
import { clipProducerEnabled, clipProducerConfigReady, coordinateClipJobs, renewClipLease, closeClipLease } from '@/lib/server/motion-studio/clip-producer-coordinator'

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
    ? (stage==='failed'?'Clip production failed. Please try again.':messages[stage] ?? "We're finishing your clip…") : m
}
type Artifact = {
  id: string; key: string; filename: string; kind: string; mime: string; bytes: number;
  state: 'pending' | 'ready'; s3UploadId?: string; sha256?: string
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
  const published = await prisma().clip.findMany({where:{workspaceId,projectId,deletedAt:null},select:{aiMeta:true}})
  const publishCounts = new Map<string,number>()
  for (const clip of published) {
    const jobId = word(object(clip.aiMeta).agentClipperRunId,100)
    if (jobId) publishCounts.set(jobId,(publishCounts.get(jobId)||0)+1)
  }
  const latest = new Map<string, typeof rows[number]>()
  for (const j of rows) if (!latest.has(j.clipId)) latest.set(j.clipId,j)
  return await Promise.all([...latest.values()].map(async j => {
    const portable=j.status==='complete'?await prisma().motionStudioPortableVersion.findFirst({
      where:{workspaceId,projectId,sourceJobId:j.id,status:'committed'},
      orderBy:{revision:'desc'},select:{id:true},
    }):null
    return {...publicJob(j),publishedClips:publishCounts.get(j.id)||0,
      delivery:portable?'live':'legacy',
      portableVersionId:portable?.id||null,
      liveEditorUrl:portable?'/app/motion-studio/'+encodeURIComponent(projectId)+'/live':null,
      videoUrl:j.resultKey&&j.status==='complete'
        ?await createReadableSignedUrl(j.resultKey,3600).catch(()=>null):null,
    }
  }))
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
  clipId: string, request: Request, idempotencyKey: string, note?: string) {
  if (!clipProducerEnabled() && (!process.env.GROKBOT_WEBHOOK_URL || !process.env.GROKBOT_WEBHOOK_KEY)) {
    throw problem('Transovo Agent is not connected yet.',503)
  }
  if (process.env.GROKBOT_LIVE_MODE !== '1') throw problem('Transovo Agent production is not enabled.',503)
  if (clipProducerEnabled() && !clipProducerConfigReady())
    throw problem('Clip producer coordinator is not enabled.',503)
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
      phase:'dispatch',status:clipProducerEnabled()?'queued':'dispatching',
      kind:clipProducerEnabled()?'clip_revision':'clips',
      ...(clipProducerEnabled()?{input:toPrismaJson({note:word(note,2000)})}:{}),
      message:'Preparing your clip for finishing.',
    }})
  } catch(e) {
    if ((e as {code?:string}).code!=='P2002') throw e
    const duplicate=await prisma().clipAgentFinishJob.findUnique({
      where:{clipId_idempotencyKey:{clipId,idempotencyKey:key}},
    })
    if (!duplicate) throw e
    return publicJob(duplicate)
  }
  if (clipProducerEnabled()) {
    await coordinateClipJobs(1)
    return publicJob(await prisma().clipAgentFinishJob.findUniqueOrThrow({where:{id}}))
  }
  // For the original upload, clip timestamps are absolute. An isolated
  // segment/preview is already clip-local and must start at zero.
  const fromOriginal=sourceKey===clip.project.upload?.key
  const startMs=fromOriginal ? clip.startMs : 0
  const endMs=fromOriginal ? clip.endMs : clip.endMs-clip.startMs
  const payload={
    version:1,action:'finish_clip',mode:'source_footage_enhancement',
    delivery:{mode:'live'},
    jobId:id,projectId,clipId,jobToken:token,jobUrl:root,callbackUrl:root,
    title:clip.title,projectTitle:clip.project.title,
    source:{url:sourceUrl,filename:clip.project.upload?.filename||'source.mp4',
      startMs,endMs,durationMs:Math.max(1,endMs-startMs)},
    durationSeconds:Math.round((clip.endMs-clip.startMs)/1000),
    aspectRatio:'9:16',fps:30,quality:'premium',
    score:clip.score,
    direction:'Find the strongest continuous story in this already-selected moment. Preserve the original voices and footage. Remove dead air or bridge moments only when editorially appropriate; do not invent dialogue or unnecessarily reassemble the story. Compose speaker-aware reframing and dynamic split-screen layouts for 1/2/3+ speakers when useful. Design story-specific kinetic typography, custom motion graphics, captions, transitions, effects and sound polish. The unified director chooses any available engines and may layer them. Preserve voice sync, speech intelligibility and editorial meaning. Deliver one editable vertical clip as transovo.live-project/1 with browser scene bundles, separate caption track and audio stems. Publish it through the /portable callback and complete with delivery:live, durationMs and portableVersionId. Do not render a master MP4.',
    mediaPolicy:'user_footage_primary',webResearch:false,
  }
  try {
    const url=new URL(process.env.GROKBOT_WEBHOOK_URL!)
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

/**
 * Project-wide autonomous clipping: Grok decides which moments deserve clips,
 * scores them, chooses the cuts, and finishes each with its creative engines.
 * This intentionally does not reuse the legacy pick list as its source of truth.
 */
export async function dispatchClipAgentDiscover(workspaceId:string,projectId:string,
  request:Request,idempotencyKey:string,maximumClips:number) {
  if ((!clipProducerEnabled() && (!process.env.GROKBOT_WEBHOOK_URL || !process.env.GROKBOT_WEBHOOK_KEY)) ||
      process.env.GROKBOT_LIVE_MODE!=='1') throw problem('Transovo Agent is not connected.',503)
  if (clipProducerEnabled() && !clipProducerConfigReady())
    throw problem('Clip producer coordinator is not enabled.',503)
  const project=await prisma().clipProject.findFirst({
    where:{id:projectId,workspaceId,deletedAt:null},
    select:{id:true,title:true,status:true,rangeEndMs:true,
      upload:{select:{key:true,filename:true,mime:true,durationMs:true}}},
  })
  if (!project) throw problem('Project not found.',404)
  if (!project.upload?.key) throw problem('Upload a source video first.',409)
  if (project.status!=='READY') throw problem('Wait for your source video to finish processing.',409)
  const slot='project:'+projectId
  const key=word(idempotencyKey,120)||'agent-discovery-v1'
  const previous=await prisma().clipAgentFinishJob.findUnique({
    where:{clipId_idempotencyKey:{clipId:slot,idempotencyKey:key}},
  })
  if(previous) return publicJob(previous)
  const active=await prisma().clipAgentFinishJob.count({where:{
    workspaceId,status:{in:['dispatching','dispatched','running']},
  }})
  if(active>=6) throw problem('Too many productions are running.',429)
  const today=new Date();today.setUTCHours(0,0,0,0)
  if(await prisma().clipAgentFinishJob.count({where:{workspaceId,createdAt:{gte:today}}})>=30)
    throw problem('Daily production limit reached.',429)
  const sourceUrl=await createReadableSignedUrl(project.upload.key,3600)
  const id='caf_'+randomUUID(),token=randomBytes(32).toString('base64url')
  const root=callbackOrigin(request)+'/api/clips/agent/jobs/'+encodeURIComponent(id)
  let job
  try {
    job=await prisma().clipAgentFinishJob.create({data:{
      id,workspaceId,projectId,clipId:slot,idempotencyKey:key,
      tokenHash:digest(id+':'+token).toString('hex'),
      tokenExpiresAt:new Date(Date.now()+36*3600_000),
      status:clipProducerEnabled()?'queued':'dispatching',phase:'dispatch',
      kind:'clips',message:'Finding your best moments.',
    }})
  }catch(err){
    if ((err as {code?:string})?.code!=='P2002') throw err
    const duplicate=await prisma().clipAgentFinishJob.findUnique({
      where:{clipId_idempotencyKey:{clipId:slot,idempotencyKey:key}},
    })
    if(!duplicate) throw err
    return publicJob(duplicate)
  }
  if (clipProducerEnabled()) {
    await coordinateClipJobs(1)
    return publicJob(await prisma().clipAgentFinishJob.findUniqueOrThrow({where:{id}}))
  }
  const payload={
    version:1,action:'clip_and_finish',mode:'autonomous_clipper',
    delivery:{mode:'live'},jobId:id,
    projectId,jobToken:token,jobUrl:root,callbackUrl:root,
    title:project.title,
    source:{url:sourceUrl,filename:project.upload.filename,mime:project.upload.mime,
      startMs:0,endMs:project.upload.durationMs??project.rangeEndMs,
      durationMs:project.upload.durationMs??project.rangeEndMs},
    maxClips:Math.max(1,Math.min(10,maximumClips)),
    targetDurationsSeconds:[30,60],aspectRatio:'9:16',fps:30,
    mediaPolicy:'user_footage_primary',webResearch:false,quality:'premium',
    direction:'You are the ONE Transovo creative director. Analyze the full source recording, including picture, dialogue, action, speakers and changes in scene. Independently identify and score its strongest self-contained moments, rank by hook, payoff, comprehensibility, action and entertainment value, then produce up to maxClips polished social clips. Preserve the subjects original speech and video. Cut dead space, reorder only if coherent, dynamically reframe and track the relevant people, choose split-screen layouts when needed, and create story-specific motion graphics, captions and transitions. Choose any available engines, including layered ones, by creative merit and vary visual DNA across clips without sacrificing cohesion. Publish one editable transovo.live-project/1 and original scene bundles for the selected highlights through /portable. Complete with delivery:live, durationMs, portableVersionId, and scored clips[] entries containing sceneId, startMs, endMs, title, score and why. Do not render MP4 masters before export. Do not make a documentary from scratch.',
  }
  try {
    const url=new URL(process.env.GROKBOT_WEBHOOK_URL!)
    if(url.protocol!=='https:') throw new Error('Webhook requires HTTPS')
    const response=await fetch(url,{method:'POST',cache:'no-store',redirect:'error',
      headers:{Authorization:'Bearer '+process.env.GROKBOT_WEBHOOK_KEY,'Content-Type':'application/json'},
      body:JSON.stringify(payload),signal:AbortSignal.timeout(15000)})
    if(!response.ok) throw new Error('Webhook not accepted')
    job=await prisma().clipAgentFinishJob.update({where:{id},data:{
      status:'dispatched',phase:'selecting',message:messages.selecting,
    }})
  }catch(e){
    job=await prisma().clipAgentFinishJob.update({where:{id},data:{
      status:'dispatch_failed',phase:'dispatch',message:'Could not start. Please try again.',
      completedAt:new Date(),error:'Producer unavailable.',
    }})
    console.error('[clip-agent] discover_dispatch_failed',{jobId:id,kind:e instanceof Error?e.name:'unknown'})
  }
  return publicJob(job)
}

/** Delivers multiple independently scored, agent-edited clips in one callback. */
async function completeDiscoveredClips(job:Awaited<ReturnType<typeof authorizeClipAgentCallback>>,
  raw:Record<string,unknown>) {
  const all=items(job.artifacts)
  const manifest=all.find(a=>a.state==='ready'&&a.filename==='highlights.json'&&a.mime==='application/json'
    &&a.bytes<=2_000_000)
  if(!manifest) throw problem('Upload highlights.json before finishing this project.',409)
  let records:unknown
  try {
    const bytes=await getClipStorage().getObjectBytes(manifest.key)
    if(bytes.byteLength>2_000_000) throw new Error('Too large')
    const data=JSON.parse(bytes.toString('utf8'))
    records=Array.isArray(data)?data:object(data).clips
  }catch{throw problem('Highlights manifest is invalid.',400)}
  if(!Array.isArray(records)||!records.length||records.length>(clipProducerEnabled()?15:10))
    throw problem('Provide 1–15 scored highlight records.',400)
  const videoFiles=new Set<string>()
  const normalized=records.map((rawRow:unknown)=>{
    const row=object(rawRow)
    const filename=word(row.filename||row.videoFilename,150)
    const title=word(row.title,120)||'Highlight'
    const startMs=Number(row.startMs),endMs=Number(row.endMs),
      durationMs=Number(row.durationMs),score=Number(row.score)
    const why=word(row.why,300)
    const video=all.find(a=>a.state==='ready'&&a.kind==='video'&&a.mime==='video/mp4'&&a.filename===filename)
    if(!video||videoFiles.has(filename)||!Number.isSafeInteger(startMs)
      ||!Number.isSafeInteger(endMs)||startMs<0||endMs<=startMs
      ||!Number.isSafeInteger(durationMs)||durationMs<1000||durationMs>180_000
      ||!Number.isInteger(score)||score<0||score>100) throw problem('Invalid scored clip or missing MP4.',400)
    videoFiles.add(filename)
    return {video,title,startMs,endMs,durationMs,score,why}
  })
  const src=await prisma().clipProject.findFirst({
    where:{id:job.projectId,workspaceId:job.workspaceId,deletedAt:null},
    select:{upload:{select:{durationMs:true}}},
  })
  if(!src) throw problem('Source project removed.',404)
  const sourceDuration=src.upload?.durationMs
  if(sourceDuration && normalized.some(r=>r.endMs>sourceDuration+1000))
    throw problem('A clip exceeds its source media.',400)
  const now=new Date()
  const completed=await prisma().$transaction(async tx=>{
    const existing=await tx.clipAgentFinishJob.findUnique({where:{id:job.id},select:{status:true}})
    if(existing?.status==='complete') return tx.clipAgentFinishJob.findUniqueOrThrow({where:{id:job.id}})
    for(const row of normalized) {
      const clipId='clip_'+randomUUID()
      await tx.clip.create({data:{
        id:clipId,workspaceId:job.workspaceId,projectId:job.projectId,
        title:row.title,reason:row.why||'Selected by Transovo Agent',
        startMs:row.startMs,endMs:row.endMs,score:row.score,
        scores:toPrismaJson({overall:row.score}),
        previewKey:row.video.key,storageDriver:storageDriverName(),
        aiMeta:toPrismaJson({
          agentClipperRunId:job.id,agentClipper:true,why:row.why,
          score:row.score,reasonTag:'both',deliveredDurationMs:row.durationMs,
          agentFinishOriginalPreviewKey:null,
          agentFinishedVersions:[{jobId:job.id,key:row.video.key,
            durationMs:row.durationMs,completedAt:now.toISOString()}],
        }),
      }})
    }
    return tx.clipAgentFinishJob.update({where:{id:job.id},data:{
      status:'complete',phase:'complete',progress:100,
      message:normalized.length+' finished clips are ready.',
      resultKey:normalized[0]!.video.key,
      durationMs:normalized.reduce((a,r)=>a+r.durationMs,0),completedAt:now,
    }})
  })
  return publicJob(completed)
}

export async function authorizeClipAgentCallback(id: string,request: Request) {
  const auth=request.headers.get('authorization')||''
  const token=auth.startsWith('Bearer ')?auth.slice(7):''
  if (!token||token.length>256) throw problem('Job authorization required.',401)
  const job=await prisma().clipAgentFinishJob.findUnique({where:{id}})
  if (!job||job.tokenExpiresAt<=new Date()) throw problem('Invalid or expired job.',401)
  const got=digest(id+':'+token),expected=Buffer.from(job.tokenHash,'hex')
  if (got.length!==expected.length||!timingSafeEqual(got,expected)) throw problem('Invalid job token.',401)
  if (job.workerId) {
    if (!job.leaseExpiresAt || job.leaseExpiresAt <= new Date() ||
        !['dispatching','dispatched','running'].includes(job.status))
      throw problem('Clip worker lease expired or revoked.',401)
    await renewClipLease(job.id,job.workerId,job.leaseExpiresAt)
  }
  return job
}


/** Re-sign media on demand: never store temporary URLs or API keys in job input. */
export async function getClipAgentInputs(id: string, request: Request) {
  const job = await authorizeClipAgentCallback(id, request)
  if (finished(job.status)) throw problem('Job is no longer active.', 409)
  const project = await prisma().clipProject.findFirst({
    where: {id: job.projectId, workspaceId: job.workspaceId, deletedAt: null},
    select: {
      title: true, settings: true, transcriptKey: true,
      upload: {select: {key: true, filename: true, mime: true, durationMs: true}},
    },
  })
  if (!project?.upload?.key) throw problem('Source video not found.', 404)
  const settings = object(project.settings)
  const selected = job.clipId.startsWith('project:') ? null : await prisma().clip.findFirst({
    where:{id:job.clipId,workspaceId:job.workspaceId,projectId:job.projectId,deletedAt:null},
    select:{startMs:true,endMs:true,title:true},
  })
  if (!job.clipId.startsWith('project:') && !selected) throw problem('Revision source clip not found.',404)
  const root = 'ws/' + job.workspaceId + '/projects/' + job.projectId + '/'
  const sign = async (key: string | null) =>
    key ? createReadableSignedUrl(key, 900).catch(() => null) : null
  const [sourceUrl, deepgramUrl, compactTranscriptUrl, wordsUrl] = await Promise.all([
    sign(project.upload.key),
    sign(root + 'deepgram.json'),
    sign(root + 'transcript.compact.jsonl'),
    sign(project.transcriptKey),
  ])
  if (!sourceUrl) throw problem('Source video unavailable.', 409)
  return {
    jobId: id, projectId: job.projectId, clipId: job.clipId,
    action: job.clipId.startsWith('project:') ? 'clip_and_finish' : 'finish_clip',
    delivery: {mode: 'mp4', editable: 'transovo.clip-edits/2'},
    source: {url: sourceUrl, filename: project.upload.filename,
      mime: project.upload.mime, durationMs: project.upload.durationMs},
    transcript: {deepgramUrl, compactTranscriptUrl, wordsUrl},
    ...(job.clipId.startsWith('project:')?{}:{
      revision: {clipId:job.clipId,note:word(object(job.input).note,2000),
        sourceStartMs:selected?.startMs,sourceEndMs:selected?.endMs,title:selected?.title},
    }),
    clipCount: Math.max(1, Math.min(15, Number(settings.autoGrokMaxClips) || 5)),
    targetSeconds: {min: 20, max: 60},
    aspectRatio: settings.aspectRatio || '9:16',
    resolution: settings.aspectRatio==='16:9'?'1920x1080':
      settings.aspectRatio==='1:1'?'1080x1080':
      settings.aspectRatio==='4:5'?'1080x1350':
      settings.aspectRatio==='3:4'?'1080x1440':'1080x1920',
    captionStyle: object(settings.captions),
    brand: object(settings.brand),
    notes: word(settings.prompt, 2000),
  }
}

/** Keep producer errors visible without echoing unsafe details into customer UI. */
export async function failClipAgentJob(id: string, request: Request, raw: unknown) {
  const job = await authorizeClipAgentCallback(id, request)
  if (job.status === 'failed') return publicJob(job)
  if (finished(job.status)) throw problem('Job already completed.', 409)
  const inputReason=word(object(raw).reason,2000)
  const reason=(inputReason||'Producer reported failure')
    .replace(/https?:\/\/\S+/gi,'[url]')
    .replace(/\bBearer\s+\S+/gi,'Bearer [redacted]')
    .replace(/(?:api[_-]?key|token|password|secret)\s*[:=]\s*\S+/gi,'[credential]')
    .replace(/\/(?:workspace|tmp|home)\/\S+/gi,'[path]').slice(0,500)
  const row = await prisma().clipAgentFinishJob.update({
    where: {id}, data: {status: 'failed', phase: 'failed', error: reason, failReason: reason,
      message: 'Clip production failed. Please try again.', completedAt: new Date()},
  })
  await closeClipLease(id,false)
  console.error('[clip-agent] producer_failed', {jobId: id, reason: 'reported'})
  return publicJob(row)
}

/** Register separately committed graphics as editor media for new clips and revisions. */
async function nativeProducerEdits(job:{workspaceId:string;projectId:string},raw:Record<string,unknown>,
  artifacts:Artifact[],startMs:number,endMs:number){
  const layers=Array.isArray(raw.broll)?raw.broll:[]
  const mapped:Record<string,unknown>[]=[]
  for(const entry of layers){
    const layer=object(entry)
    if(layer.source!=='upload'){mapped.push(layer);continue}
    const filename=word(layer.artifactFilename||layer.uploadId,150)
    const artifact=artifacts.find(a=>a.state==='ready'&&a.filename===filename&&
      ['video/mp4','video/webm','image/png','image/webp'].includes(a.mime))
    if(!artifact)throw problem('Missing committed overlay asset.',409)
    const uploadId='clipa_'+artifact.id
    await prisma().clipUpload.upsert({where:{id:uploadId},
      create:{id:uploadId,workspaceId:job.workspaceId,key:artifact.key,
        filename:artifact.filename,bytes:BigInt(artifact.bytes),mime:artifact.mime,
        kind:'media',status:'COMPLETE',storageDriver:storageDriverName()},update:{}})
    await registerProjectMedia(job.workspaceId,job.projectId,{uploadId,label:artifact.filename})
    mapped.push({...layer,source:'upload',uploadId})
  }
  return normalizeEdits({...raw,broll:mapped},{clipStartMs:startMs,clipEndMs:endMs})
}

/** Write transcript words only once the database clip is actually published. */
async function refreshClipWords(job:{workspaceId:string;projectId:string},clipId:string,startMs:number,endMs:number){
  try{
    const root='ws/'+job.workspaceId+'/projects/'+job.projectId+'/'
    const raw=await getClipStorage().getJson<unknown>(root+'words.json')
    const words=Array.isArray(raw)?raw:[]
    const selected=words.filter(v=>{
      const w=object(v),s=Number(w.s),e=Number(w.e)
      return Number.isFinite(s)&&Number.isFinite(e)&&e*1000>=startMs&&s*1000<=endMs
    })
    if(!selected.length)return
    const key=root+'clips/'+clipId+'/words.json'
    await getClipStorage().putJson(key,selected)
    await prisma().clip.updateMany({where:{id:clipId,workspaceId:job.workspaceId,
      projectId:job.projectId,deletedAt:null},data:{wordsKey:key}})
  }catch{console.warn('[clip-agent] words_refresh_failed',{clipId})}
}

/** Publish one committed MP4 result immediately; repeated callbacks are idempotent. */
export async function publishClipAgentResult(id: string, request: Request, raw: unknown) {
  const job = await authorizeClipAgentCallback(id, request)
  if (finished(job.status)) throw problem('Job no longer accepts clips.', 409)
  if (!job.clipId.startsWith('project:')) throw problem('Per-clip publish requires discovery.', 409)
  const input = object(raw)
  const manifestName = word(input.clipJson, 150)
  const editsName = word(input.editsJson, 150)
  const videoName = word(input.video, 150)
  const previewName = word(input.preview, 150)
  const posterName = word(input.thumbnail, 150)
  const artifacts = items(job.artifacts)
  const artifact = (name: string, mime: string) => artifacts.find(a =>
    a.filename === name && a.mime === mime && a.state === 'ready')
  const manifest = artifact(manifestName, 'application/json')
  const video = artifact(videoName, 'video/mp4')
  const preview = artifact(previewName, 'video/mp4')
  const poster = artifacts.find(a => a.filename === posterName && a.state === 'ready' &&
    ['image/jpeg','image/png','image/webp'].includes(a.mime))
  if (!manifest || !video || !preview || !poster) throw problem('Commit clip metadata, full MP4, 480p preview and thumbnail first.', 409)
  if (manifest.bytes > 2_000_000) throw problem('Clip metadata is too large.', 400)
  let detail: Record<string, unknown>
  try {
    detail = object(JSON.parse((await getClipStorage().getObjectBytes(manifest.key)).toString('utf8')))
  } catch {throw problem('Invalid clip.json.', 400)}
  const startMs = Number(detail.sourceStartMs), endMs = Number(detail.sourceEndMs)
  const virality = Number(detail.virality), durationMs = Number(detail.durationMs)
  if (!Number.isSafeInteger(startMs) || startMs < 0 || !Number.isSafeInteger(endMs) ||
      endMs <= startMs || !Number.isInteger(virality) || virality < 1 || virality > 10 ||
      !Number.isSafeInteger(durationMs) || durationMs < 1000 || durationMs > 600_000)
    throw problem('Invalid source range, virality or rendered duration.', 400)
  const source = await prisma().clipProject.findFirst({where:{
    id: job.projectId, workspaceId: job.workspaceId, deletedAt: null,
  },select:{upload:{select:{durationMs:true}}}})
  if (!source || (source.upload?.durationMs && endMs > source.upload.durationMs + 1000))
    throw problem('Clip exceeds original media.', 400)
  let editable = false
  let edits: ClipEditsV2 = normalizeEdits(null, {clipStartMs: startMs, clipEndMs: endMs})
  const editArtifact = artifact(editsName, 'application/json')
  if (editArtifact && editArtifact.bytes <= 2_000_000) {
    try {
      const doc = object(JSON.parse((await getClipStorage().getObjectBytes(editArtifact.key)).toString('utf8')))
      if (doc.schema !== 'transovo.clip-edits/2') throw new Error('Invalid edit schema')
      const rawEdits = object(doc.edits)
      const trim = object(rawEdits.trim)
      if (Number(trim.in) !== startMs || Number(trim.out) !== endMs)
        throw new Error('Edit trim does not match published source range')
      edits = await nativeProducerEdits(job,rawEdits,artifacts,startMs,endMs)
      editable = true
    } catch {console.warn('[clip-agent] invalid_edits_fallback', {jobId: id})}
  } else console.warn('[clip-agent] missing_edits_fallback', {jobId: id})

  const score = virality * 10
  const newClipId = 'clip_' + randomUUID()
  const result = await prisma().$transaction(async tx => {
    await tx.$queryRaw`SELECT "id" FROM "clip_agent_finish_jobs" WHERE "id" = ${id} FOR UPDATE`
    const existing = await tx.clip.findMany({where:{workspaceId: job.workspaceId,
      projectId:job.projectId, deletedAt:null},select:{id:true,aiMeta:true}})
    // An explicit producer manifest filename is a stable idempotency key.
    const count = existing.filter(c=>object(c.aiMeta).agentClipperRunId===id).length
    const duplicate = existing.find(c=>object(c.aiMeta).agentClipManifest === manifestName &&
      object(c.aiMeta).agentClipperRunId === id)
    if (duplicate) return {clipId:duplicate.id,created:false}
    if (count>=15) throw problem('Maximum of 15 clips per production.',409)
    const clipId = newClipId
    await tx.clip.create({data:{
      id:clipId, workspaceId:job.workspaceId,projectId:job.projectId,
      title:word(detail.title, 120) || 'Highlight',reason:word(detail.why, 300) || 'Selected by Transovo Agent',
      startMs,endMs,score,scores:toPrismaJson({overall:score}),
      previewKey:preview.key,posterKey:poster.key,storageDriver:storageDriverName(),
      edits:toPrismaJson(edits), editsSaveVersion:1,
      aiMeta:toPrismaJson({agentClipper:true,agentClipperRunId:id,agentClipManifest:manifestName,
        virality,hook:word(detail.hook, 500),speakers:detail.speakers,
        fullResKey:video.key,agentFullResEditsVersion:1,deliveredDurationMs:durationMs,
        agentFinishEditableLayersImported:editable,
        agentFinishedVersions:[{jobId:id,key:video.key,durationMs,completedAt:new Date().toISOString()}]}),
    }})
    await tx.clipEditVersion.create({data:{id:'cev_'+randomUUID(),clipId,
      workspaceId:job.workspaceId,name:'Producer original',kind:'original',
      edits:toPrismaJson(edits),editsSaveVersion:1}})
    return {clipId,created:true}
  })
  if(result.created)await refreshClipWords(job,result.clipId,startMs,endMs)
  return {clipId: result.clipId, published: true, editable, score}
}

export async function getClipAgentAssignment(id: string,request: Request) {
  const j=await authorizeClipAgentCallback(id,request)
  return {...publicJob(j),mode:'source_footage_enhancement',
    delivery:{mode:clipProducerEnabled()?'mp4':'live'},
    portableUrl:clipProducerEnabled()?null:callbackOrigin(request)+'/api/clips/agent/jobs/'+encodeURIComponent(id)+'/portable'}
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

/** Serialize JSON artifact mutations under a Postgres row lock.
 * Multiple video/graphics uploads can commit in parallel without lost entries. */
async function updateArtifactsLocked(id:string,change:(all:Artifact[])=>Artifact[]) {
  await prisma().$transaction(async tx=>{
    await tx.$queryRaw`SELECT "id" FROM "clip_agent_finish_jobs" WHERE "id" = ${id} FOR UPDATE`
    const row=await tx.clipAgentFinishJob.findUnique({where:{id},select:{artifacts:true,status:true}})
    if(!row||finished(row.status)) throw problem('Job is no longer accepting artifacts.',409)
    const next=change(items(row.artifacts).map(a=>({...a})))
    await tx.clipAgentFinishJob.update({where:{id},data:{artifacts:toPrismaJson(next)}})
  })
}
export async function clipAgentArtifact(id: string,request: Request,raw: unknown) {
  const j=await authorizeClipAgentCallback(id,request)
  if (finished(j.status)) throw problem('Job already finished.',409)
  const input=object(raw), action=word(input.action,20)
  const all=items(j.artifacts)
  if (action==='prepare') {
    const filename=word(input.filename,150).replace(/[^A-Za-z0-9._-]/g,'_')
    const kind=word(input.kind,24),mime=word(input.mime,80),bytes=Number(input.bytes)
    const checksum=word(input.sha256,64).toLowerCase()
    const sourceKind=['bundle','font','image'].includes(kind)
    if (!filename || !['video','project','media','audio','source','bundle','font','image','caption','subtitle'].includes(kind)
      || !['video/mp4','video/webm','application/json','image/png','image/jpeg','image/webp',
        'audio/mpeg','audio/wav','audio/mp4','text/vtt','application/x-subrip',
        'text/javascript','application/javascript','application/wasm','text/css',
        'font/ttf','font/otf','font/woff','font/woff2','application/octet-stream'].includes(mime)
      || (sourceKind&&(!/^[a-f0-9]{64}$/.test(checksum)||bytes>25*1024*1024))
      || (checksum&&!/^[a-f0-9]{64}$/.test(checksum))
      || !Number.isSafeInteger(bytes)||bytes<1||bytes>MAX_FILE_BYTES||all.length>=10000) {
      throw problem('Invalid artifact.',400)
    }
    const uploadId=randomUUID()
    const objectKey='ws/'+j.workspaceId+'/clip-agent/'+id+'/'+uploadId+'/'+filename
    const upload=await getClipStorage().createUpload({workspaceId:j.workspaceId,uploadId,
      filename,mime,bytes,objectKey})
    const item:Artifact={id:uploadId,key:objectKey,filename,kind,mime,bytes,state:'pending',
      ...(checksum?{sha256:checksum}:{}),
      ...(upload.s3Multipart?{s3UploadId:upload.s3Multipart.uploadId}:{})}
    await updateArtifactsLocked(id,current=>{
      if(current.length>=10000) throw problem('Too many job artifacts.',400)
      return [...current,item]
    })
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
    if (!size||size>MAX_FILE_BYTES||size!==item.bytes)
      throw problem('Uploaded artifact size mismatch.',400)
    if(item.sha256){
      if(size>25*1024*1024)throw problem('Hashed clip scene asset exceeds 25 MB.',413)
      const actual=createHash('sha256').update(await storage.getObjectBytes(item.key)).digest('hex')
      if(actual!==item.sha256)throw problem('Uploaded asset SHA-256 mismatch.',422)
    }
    await updateArtifactsLocked(id,current=>{
      const latest=current.find(a=>a.id===item.id)
      if(!latest) throw problem('Prepared artifact no longer exists.',409)
      latest.state='ready'
      return current
    })
    return {uploadId:item.id,status:'ready',bytes:size}
  }
  throw problem('Expected prepare or commit.',400)
}

async function completeDiscoveredLiveClips(
  job:Awaited<ReturnType<typeof authorizeClipAgentCallback>>,
  body:Record<string,unknown>,versionId:string,durationMs:number,
){
  const raw=Array.isArray(body.clips)?body.clips:[]
  if(!raw.length||raw.length>(clipProducerEnabled()?15:10))
    throw problem('Live discovery must return scored clip windows.',400)
  const clips=raw.map(value=>{
    const row=object(value)
    const title=word(row.title,120)||'Highlight'
    const startMs=Number(row.startMs),endMs=Number(row.endMs),score=Number(row.score)
    const sceneId=word(row.sceneId,128)
    if(!Number.isSafeInteger(startMs)||!Number.isSafeInteger(endMs)||
       startMs<0||endMs<=startMs||endMs>durationMs||
       !Number.isInteger(score)||score<0||score>100||!sceneId)
      throw problem('Invalid live clip window.',400)
    return {title,startMs,endMs,score,sceneId,why:word(row.why,300)}
  })
  const project=await prisma().motionStudioPortableVersion.findFirst({
    where:{id:versionId,workspaceId:job.workspaceId,projectId:job.projectId},
    select:{manifest:true},
  })
  const scenes=Array.isArray(object(project?.manifest).scenes)?
    (object(project?.manifest).scenes as unknown[]).map(a=>object(a).id):[]
  if(clips.some(c=>!scenes.includes(c.sceneId)))
    throw problem('Discovered clip references a missing live scene.',400)
  const now=new Date()
  const result=await prisma().$transaction(async tx=>{
    for(const clip of clips){
      await tx.clip.create({data:{
        id:'clip_'+randomUUID(),workspaceId:job.workspaceId,projectId:job.projectId,
        title:clip.title,reason:clip.why||'Selected by Transovo Agent',
        startMs:clip.startMs,endMs:clip.endMs,score:clip.score,
        scores:toPrismaJson({overall:clip.score}),
        aiMeta:toPrismaJson({agentClipper:true,agentClipperRunId:job.id,
          agentFinishDelivery:'live',agentFinishLiveProjectId:job.projectId,
          agentFinishLiveVersionId:versionId,sceneId:clip.sceneId}),
      }})
    }
    return tx.clipAgentFinishJob.update({where:{id:job.id},data:{
      status:'complete',phase:'complete',progress:100,
      message:clips.length+' editable clips are ready.',
      resultKey:null,durationMs,completedAt:now,
    }})
  })
  return {...publicJob(result),delivery:'live',portableVersionId:versionId}
}

export async function completeClipAgentJob(id: string,request: Request,raw: unknown) {
  const job=await authorizeClipAgentCallback(id,request)
  if (job.status==='complete') return publicJob(job)
  if (finished(job.status)) throw problem('Job already finished.',409)
  const body=object(raw)
  if (body.status==='failed') return failClipAgentJob(id,request,{reason:body.reason})
  if (body.delivery==='live'){
    const versionId=word(body.portableVersionId,128)
    const durationMs=Number(body.durationMs)
    const version=await prisma().motionStudioPortableVersion.findFirst({
      where:{id:versionId,workspaceId:job.workspaceId,projectId:job.projectId,
        sourceJobId:id,status:'committed'},
    })
    if(!version||!Number.isSafeInteger(durationMs)||durationMs<1||durationMs>2_147_483_647)
      throw problem('Publish the clip live timeline before completing.',409)
    const manifest=object(version.manifest)
    const live=object(manifest.liveProject)
    if(live.schema!=='transovo.live-project/1'||Number(object(live.format).durationMs)!==durationMs)
      throw problem('Invalid live clip timeline or duration.',409)
    const assets=Array.isArray(manifest.assets)?manifest.assets:[]
    const assetIds=assets.map(a=>String(object(a).id||''))
    const present=await prisma().studioAsset.count({where:{
      workspaceId:job.workspaceId,projectId:job.projectId,status:'ready',
      id:{in:assetIds},
    }})
    if(present!==assetIds.length)throw problem('Live clip media is incomplete.',409)
    if(job.clipId==='project:'+job.projectId)
      return completeDiscoveredLiveClips(job,body,versionId,durationMs)
    const now=new Date()
    const completed=await prisma().$transaction(async tx=>{
      const clip=await tx.clip.findFirst({where:{
        id:job.clipId,workspaceId:job.workspaceId,projectId:job.projectId,deletedAt:null,
      },select:{aiMeta:true}})
      if(!clip)throw problem('Original clip no longer exists.',404)
      await tx.clip.update({where:{id:job.clipId},data:{aiMeta:toPrismaJson({
        ...object(clip.aiMeta),agentFinishLiveVersionId:versionId,
        agentFinishLiveProjectId:job.projectId,agentFinishActiveJobId:id,
        agentFinishDelivery:'live',
      })}})
      return tx.clipAgentFinishJob.update({where:{id},data:{
        status:'complete',phase:'complete',progress:100,message:messages.complete,
        resultKey:null,durationMs,completedAt:now,
      }})
    })
    return {...publicJob(completed),delivery:'live',portableVersionId:versionId}
  }
  if (job.clipId==='project:'+job.projectId) {
    const reportName=word(body.jobJson,150)
    const report=items(job.artifacts).find(a=>a.filename===reportName && a.mime==='application/json' && a.state==='ready' && a.bytes<=2_000_000)
    if (clipProducerEnabled() && !report) throw problem('Upload and commit job.json before completing.',409)
    if (clipProducerEnabled() && report) {
      let costReport:Record<string,unknown>
      try {costReport=object(JSON.parse((await getClipStorage().getObjectBytes(report.key)).toString('utf8')))}
      catch {throw problem('Invalid job.json report.',400)}
      const finishedClips=await prisma().clip.findMany({where:{workspaceId:job.workspaceId,projectId:job.projectId,deletedAt:null},select:{aiMeta:true}})
      const count=finishedClips.filter(c=>object(c.aiMeta).agentClipperRunId===id).length
      if(!count)throw problem('Publish at least one finished clip before completing.',409)
      const completed=await prisma().clipAgentFinishJob.update({where:{id},data:{
        status:'complete',phase:'complete',progress:100,completedAt:new Date(),
        message:count+' finished clips are ready.',costReport:toPrismaJson(costReport),
      }})
      await closeClipLease(id,true)
      return publicJob(completed)
    }
    const result=await completeDiscoveredClips(job,body)
    await closeClipLease(id,true)
    return result
  }
  const fullName=word(body.video,150)
  const previewName=word(body.preview,150)
  const editName=word(body.editsJson,150)
  const video=items(job.artifacts).find(a=>a.state==='ready'&&a.kind==='video'&&a.mime==='video/mp4'&&
    (!clipProducerEnabled()||a.filename===fullName))
  const preview=clipProducerEnabled()?items(job.artifacts).find(a=>a.state==='ready'&&a.kind==='video'&&a.mime==='video/mp4'&&a.filename===previewName):null
  const posterName=word(body.thumbnail,150)
  const poster=clipProducerEnabled()?items(job.artifacts).find(a=>a.state==='ready'&&a.filename===posterName&&
    ['image/png','image/jpeg','image/webp'].includes(a.mime)):null
  if (!video || (clipProducerEnabled()&&!preview)) throw problem('Upload and commit the finished MP4 and 480p preview first.',409)
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
  },select:{edits:true,startMs:true,endMs:true}})
  if (!existing) throw problem('Source clip was removed.',404)
  const base=existing.edits as unknown as ClipEditsV2
  let imported:ClipEditsV2|null=null
  const editFile=items(job.artifacts).find(a=>a.filename===editName&&a.state==='ready'&&a.mime==='application/json'&&a.bytes<=2_000_000)
  if (clipProducerEnabled()&&editFile) {
    try {
      const doc=object(JSON.parse((await getClipStorage().getObjectBytes(editFile.key)).toString('utf8')))
      const rawEdits=object(doc.edits)
      const trim=object(rawEdits.trim)
      if(doc.schema!=='transovo.clip-edits/2'||Number(trim.in)!==existing.startMs||
        Number(trim.out)!==existing.endMs)throw new Error('Invalid native clip edit')
      imported=await nativeProducerEdits(job,rawEdits,items(job.artifacts),existing.startMs,existing.endMs)
    }catch{console.warn('[clip-agent] revision_edits_fallback',{jobId:id})}
  }
  if (!imported && items(job.artifacts).some(a=>a.filename==='project.json'&&a.state==='ready')) {
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
      previewKey:preview?.key||video.key,
      ...(poster?{posterKey:poster.key}:{}),storageDriver:storageDriverName(),
      ...(imported?{edits:toPrismaJson(imported),editsSaveVersion:{increment:1}}:{}),
      aiMeta:toPrismaJson({...meta,agentFinishOriginalPreviewKey:
        meta.agentFinishOriginalPreviewKey||clip.previewKey||null,
        agentFinishedVersions:versions,
        ...(clipProducerEnabled()?{fullResKey:video.key,
          agentFullResEditsVersion:clip.editsSaveVersion+(imported?1:0),
          deliveredDurationMs:durationMs}:{}),
        agentFinishActiveJobId:id,
        agentFinishEditableLayersImported:Boolean(imported)}),
    }})
    // The original editable clip timeline is deliberately preserved. This output
    // is an enhanced master preview/download, never destructive replacement.
    return tx.clipAgentFinishJob.update({where:{id},data:{
      status:'complete',phase:'complete',progress:100,message:messages.complete,
      resultKey:video.key,durationMs,completedAt:now,
    }})
  })
  if(clipProducerEnabled())await refreshClipWords(job,job.clipId,existing.startMs,existing.endMs)
  await closeClipLease(id,true)
  return publicJob(result)
}

export function clipAgentError(err: unknown) {
  const status=typeof (err as {status?:unknown})?.status==='number'
    ? (err as {status:number}).status : 500
  if(status===500) console.error('[clip-agent] server_error',{kind:err instanceof Error?err.name:'unknown'})
  return Response.json({error:status===500?'Clip finishing is temporarily unavailable.':
    err instanceof Error?err.message:'Invalid request.'},{status})
}
