#!/usr/bin/env node
/**
 * Batch 8 CLI. Use: pnpm exec tsx scripts/template-factory.ts <command> [args].
 * This CLI never publishes to the runtime gallery. A preview request is NOT a
 * real render: only actual existing worker MP4/PNG plus verified QA can release.
 */
import { createHash } from 'node:crypto'
import { createReadStream, existsSync, mkdirSync, readFileSync, readdirSync, renameSync,
  rmSync, openSync, closeSync, writeFileSync } from 'node:fs'
import { resolve, dirname, join, sep } from 'node:path'
import { performance } from 'node:perf_hooks'
import { spawnSync } from 'node:child_process'
import { FACTORY_FAMILY_SEEDS, FACTORY_TREATMENTS } from '../lib/clips/real-video-templates/b8-authoring-catalog'
import { lintB8Legibility } from '../lib/clips/real-video-templates/b8-legibility'
import { b8ReferenceForFamily } from '../lib/clips/real-video-templates/b8-reference-catalog'
import { generateB8Candidates, proveB8Structure, reportB8Quality,
  locallyApprovedB8Releases, shardB8Jobs, auditB8EditableOutput, auditB8Evidence,
  B8_ENGINE_REVISION, reconcileB8Queue,
  type B8Candidate, type B8Evidence, type B8QueueJobState } from '../lib/clips/real-video-templates/b8-factory'
import { templateFrameToMs, type TemplateAsset, type TemplateDesignV1,
  type TemplateFamilyV1 } from '../lib/clips/real-video-templates/sequence-contract'
import { compileTemplateWithMusic, type TemplateMusicDecisionV1 } from '../lib/clips/real-video-templates/music-sequence'
import { assertAudioLicense } from '../lib/clips/real-video-templates/music-timing'
import { syncB8FamilyToMusic } from '../lib/clips/real-video-templates/b8-music-sync'
import { defaultEdits, type ClipEditsV2 } from '../lib/clips/edits'
import {
  b8ApiJson,b8Download,b8Poll,b8RemoteConfig,type B8RemoteConfig,
} from './template-factory-worker'
import {
  B8_RENDER_QA_REVISION, summarizeB8AudioEnvelopeQA, summarizeB8FrameQA,
} from '../lib/clips/real-video-templates/b8-render-qa'

const args=process.argv.slice(2)
const command=args[0] ?? 'help'
const argument=(name:string, fallback:string) => {
  const i=args.indexOf(name)
  return i>=0 && args[i+1] ? args[i+1]! : fallback
}
const directory=resolve(process.cwd(),argument('--out','build/real-video-templates/b8'))
const publicDir=resolve(process.cwd(),'public')
const evidencePath=resolve(process.cwd(),argument('--evidence',join(directory,'evidence.json')))
const fixturePath=resolve(process.cwd(),argument('--fixtures',join(directory,'fixtures.json')))
const HASH=/^[a-f0-9]{64}$/i
const safeName=/^[a-z0-9_]{2,80}$/
const candidates=generateB8Candidates()
const index=new Map(candidates.map(c=>[c.id,c]))
function save(file:string,object:unknown) {
  mkdirSync(dirname(file),{recursive:true})
  const temp=file+'.tmp-'+process.pid
  try { writeFileSync(temp,JSON.stringify(object,null,2)+'\n','utf8');renameSync(temp,file) }
  finally {if(existsSync(temp))rmSync(temp)}
}
function readJSON<T>(path:string):T {
  if(!existsSync(path))throw new Error('Missing input: '+path)
  return JSON.parse(readFileSync(path,'utf8')) as T
}
function fileInPublic(url:string):string {
  if(typeof url!=='string'||!/^\/(?!\/)[\w./-]+$/.test(url)||url.includes('..'))
    throw new Error('Only local public media paths are permitted')
  const path=resolve(publicDir,'.'+url)
  if(!path.startsWith(publicDir+sep))throw new Error('File leaves public media root')
  return path
}
async function shaFile(path:string):Promise<string>{
  const h=createHash('sha256')
  for await(const chunk of createReadStream(path))h.update(chunk)
  return h.digest('hex')
}
async function verifyPublic(url:string,expected:string):Promise<boolean>{
  try {const p=fileInPublic(url);return existsSync(p)&&HASH.test(expected)&&
    await shaFile(p)===expected.toLowerCase()}catch{return false}
}
type Fixture={id:string;kind:'image'|'video';path:string;sha256:string;
  durationFrames?:number;license:{id:string;provenance:'user-owned'|'first-party'|'licensed';reference:string}}
type FixtureManifest={v:1;rendererRevision:string;media:Fixture[];
  soundtrack?:{asset:TemplateAsset;path:string;sha256:string;decision:TemplateMusicDecisionV1}}
async function verifiedFixtures():Promise<FixtureManifest>{
  const fixture=readJSON<FixtureManifest>(fixturePath)
  if(fixture.v!==1||!fixture.media?.length||!fixture.rendererRevision)throw new Error('Invalid fixtures')
  const ids=new Set<string>()
  for(const row of fixture.media){
    if(!safeName.test(row.id)||ids.has(row.id)||!HASH.test(row.sha256)||
       !['image','video'].includes(row.kind)||!row.license?.reference||
       !await verifyPublic(row.path,row.sha256))
      throw new Error('Fixture must exist with exact licensed bytes: '+row.id)
    if(row.kind==='video'){
      if(!Number.isSafeInteger(row.durationFrames)||!row.durationFrames)
        throw new Error('Video fixture needs verified durationFrames: '+row.id)
      const actual=probe(fileInPublic(row.path))
      if(!actual.hasVideo||Math.abs(actual.durationFrames-row.durationFrames)>1)
        throw new Error('Video fixture frame count differs from actual decoded media: '+row.id)
    }
    ids.add(row.id)
  }
  if(fixture.soundtrack){
    const {asset,path,sha256,decision}=fixture.soundtrack
    if(asset?.kind!=='audio'||!asset.id||!asset.license?.reference||
       !Number.isInteger(asset.durationFrames)||!asset.durationFrames||
       !HASH.test(sha256)||!await verifyPublic(path,sha256))
      throw new Error('Pinned soundtrack requires real local audio bytes and license metadata')
    assertAudioLicense(decision.rights)
    if(decision.v!==1||decision.choice==='re-sync'||
       decision.rights.assetId!==asset.id||decision.rights.sha256!==sha256||
       decision.rights.verifiedDurationFrames!==asset.durationFrames||
       decision.schedule.musicAssetId!==asset.id||decision.schedule.sha256!==sha256||
       decision.schedule.durationFrames!==asset.durationFrames)
      throw new Error('Soundtrack rights, bytes and approved beat schedule differ')
    const measured=probe(fileInPublic(path))
    if(!measured.hasAudio||Math.abs(measured.durationFrames-asset.durationFrames)>1)
      throw new Error('Pinned soundtrack duration differs from decoded audio')
  }
  return fixture
}
type MeasuredRenderQA={
  qaRevision:typeof B8_RENDER_QA_REVISION
  id:string;definitionHash:string;previewSha256:string;renderSha256:string
  expectedFrames:number;previewFrames:number;renderFrames:number
  previewHasAudio:boolean;renderHasAudio:boolean
  durationMatch:boolean;audioStreamParity:boolean;audioContentParity:boolean
  audioEnvelopeDifference:number
  blackFrames:number[];flashFrames:number[]
  fullFrameParity:boolean;checkedFrameCount:number
  firstLastNotBlack:boolean;boundariesNotBlack:boolean;noExcessFlashing:boolean
  maxFrameDifference:number;p95FrameDifference:number
}
async function verifiedEvidence(requireMeasuredQA=true):Promise<B8Evidence[]> {
  const evidence=existsSync(evidencePath)?readJSON<B8Evidence[]>(evidencePath):[]
  if(!Array.isArray(evidence))throw new Error('Evidence file must be an array')
  const out:B8Evidence[]=[]
  for(const e of evidence){
    if(!index.has(e.id))throw new Error('Evidence for unknown candidate '+e.id)
    const values=e.outputs
    const okay=Boolean(values && await verifyPublic(values.previewMp4,values.previewSha256) &&
      await verifyPublic(values.renderMp4,values.renderSha256) &&
      await verifyPublic(values.poster,values.posterSha256))
    const candidate=index.get(e.id)!
    const sidecar=join(directory,'media-qa',e.id+'.json')
    let measurement:MeasuredRenderQA|null=null
    if(requireMeasuredQA&&okay&&existsSync(sidecar)){
      try{measurement=readJSON<MeasuredRenderQA>(sidecar)}catch{measurement=null}
    }
    const matched=Boolean(okay&&measurement&&
      measurement.qaRevision===B8_RENDER_QA_REVISION&&measurement.id===candidate.id&&
      measurement.definitionHash===candidate.definitionHash&&
      measurement.previewSha256===values.previewSha256&&
      measurement.renderSha256===values.renderSha256&&
      e.renderTiming?.v===1&&measurement.expectedFrames===e.renderTiming.totalFrames&&
      measurement.previewHasAudio===true&&measurement.renderHasAudio===true&&
      measurement.checkedFrameCount>=e.renderTiming.totalFrames-1)
    const valid=Boolean(matched&&measurement&&measurement.durationMatch&&
      measurement.audioStreamParity&&measurement.audioContentParity&&
      measurement.firstLastNotBlack&&measurement.boundariesNotBlack&&
      measurement.fullFrameParity&&measurement.noExcessFlashing)
    out.push({...e,checks:{...e.checks,
      durationMatch:requireMeasuredQA?Boolean(matched&&measurement?.durationMatch):Boolean(e.checks?.durationMatch),
      audioParity:requireMeasuredQA?Boolean(matched&&measurement?.audioStreamParity&&measurement?.audioContentParity):Boolean(e.checks?.audioParity),
      firstLastNotBlack:requireMeasuredQA?Boolean(matched&&measurement?.firstLastNotBlack):Boolean(e.checks?.firstLastNotBlack),
      boundariesNotBlack:requireMeasuredQA?Boolean(matched&&measurement?.boundariesNotBlack):Boolean(e.checks?.boundariesNotBlack),
      sampledFrameParity:requireMeasuredQA?Boolean(matched&&measurement?.fullFrameParity):Boolean(e.checks?.sampledFrameParity),
      noExcessFlashing:requireMeasuredQA?Boolean(matched&&measurement?.noExcessFlashing):Boolean(e.checks?.noExcessFlashing),
      actualWorkerRender:Boolean(okay&&e.checks?.actualWorkerRender===true&&
        (!requireMeasuredQA||valid))}})
  }
  return out
}
function requiredCandidate():B8Candidate {
  const id=args[1]
  const candidate=id?index.get(id):undefined
  if(!candidate)throw new Error('Specify a known design ID, e.g. f01_bold')
  return candidate
}
type QueueJob=B8QueueJobState
function withQueueLock<T>(fn:()=>T):T {
  mkdirSync(directory,{recursive:true})
  const lock=join(directory,'jobs.lock')
  let handle:number
  try {handle=openSync(lock,'wx')}catch{throw new Error('Another factory scheduler owns jobs.lock')}
  try{return fn()}finally{closeSync(handle);rmSync(lock,{force:true})}
}
function loadQueue():QueueJob[] {return readJSON<QueueJob[]>(join(directory,'jobs.json'))}
type FFProbeResult={format?:{duration?:string};streams?:Array<{codec_type?:string}>}
function probe(file:string):{durationFrames:number;hasAudio:boolean;hasVideo:boolean}{
  const output=spawnSync('ffprobe',['-v','error','-show_entries','format=duration',
    '-show_entries','stream=codec_type','-of','json',file],{
      encoding:'utf8',timeout:30000,maxBuffer:1024*1024,
    })
  if(output.status!==0)throw new Error('ffprobe failed on real worker output: '+file)
  const data=JSON.parse(output.stdout) as FFProbeResult
  const duration=Number(data.format?.duration)
  if(!Number.isFinite(duration)||duration<=0)throw new Error('Video metadata has no duration')
  return {durationFrames:Math.round(duration*30),
    hasAudio:Boolean(data.streams?.some(stream=>stream.codec_type==='audio')),
    hasVideo:Boolean(data.streams?.some(stream=>stream.codec_type==='video'))}
}
const QA_WIDTH=48,QA_HEIGHT=48,QA_FRAME_BYTES=QA_WIDTH*QA_HEIGHT*3
function decodeAllFrames(file:string):Buffer{
  const output=spawnSync('ffmpeg',['-nostdin','-v','error','-i',file,
    '-vf',`fps=30,scale=${QA_WIDTH}:${QA_HEIGHT}:flags=lanczos,format=rgb24`,
    '-f','rawvideo','-pix_fmt','rgb24','-'],{
      encoding:null,timeout:120000,maxBuffer:128*1024*1024,
    })
  if(output.status!==0||!Buffer.isBuffer(output.stdout)||!output.stdout.length||
     output.stdout.length%QA_FRAME_BYTES)
    throw new Error('FFmpeg cannot decode complete RGB frame stream')
  return output.stdout
}
function audioEnvelope(file:string):number[]{
  const output=spawnSync('ffmpeg',['-nostdin','-v','error','-i',file,
    '-map','0:a:0','-vn','-ac','1','-ar','8000','-f','s16le','-'],{
      encoding:null,timeout:120000,maxBuffer:128*1024*1024,
    })
  if(output.status!==0||!Buffer.isBuffer(output.stdout)||output.stdout.length<1600)
    throw new Error('FFmpeg cannot decode the rendered soundtrack')
  const pcm=output.stdout
  const samples=Math.floor(pcm.length/2),window=800
  const envelope:number[]=[]
  for(let start=0;start<samples;start+=window){
    const end=Math.min(samples,start+window)
    let sum=0
    for(let i=start;i<end;i++)sum+=Math.abs(pcm.readInt16LE(i*2))
    envelope.push(sum/Math.max(1,end-start))
  }
  return envelope
}
async function qaMedia(candidate:B8Candidate,evidence:B8Evidence){
  const output=evidence.outputs
  if(!output||!await verifyPublic(output.previewMp4,output.previewSha256)||
      !await verifyPublic(output.renderMp4,output.renderSha256))
    throw new Error('No actual hashed preview+render MP4 available for analysis')
  const preview=fileInPublic(output.previewMp4)
  const rendered=fileInPublic(output.renderMp4)
  const pp=probe(preview),pr=probe(rendered)
  const expected=evidence.renderTiming?.totalFrames??candidate.family.totalFrames
  const boundaries=evidence.renderTiming?.boundaries?.slice(1,-1)??
    candidate.family.slots.slice(1).map(slot=>slot.startFrame)
  const frameQA=summarizeB8FrameQA({
    previewRgb:decodeAllFrames(preview),renderRgb:decodeAllFrames(rendered),
    width:QA_WIDTH,height:QA_HEIGHT,expectedFrames:expected,boundaryFrames:boundaries,
  })
  const audioQA=pp.hasAudio&&pr.hasAudio
    ? summarizeB8AudioEnvelopeQA(audioEnvelope(preview),audioEnvelope(rendered))
    : {previewWindows:0,renderWindows:0,envelopeDifference:Number.POSITIVE_INFINITY,contentParity:false}
  const audioStreamParity=pp.hasAudio&&pr.hasAudio
  const data:MeasuredRenderQA={qaRevision:B8_RENDER_QA_REVISION,
    id:candidate.id,definitionHash:candidate.definitionHash,
    previewSha256:output.previewSha256,renderSha256:output.renderSha256,
    expectedFrames:expected,previewFrames:frameQA.previewFrames,
    renderFrames:frameQA.renderFrames,previewHasAudio:pp.hasAudio,renderHasAudio:pr.hasAudio,
    durationMatch:frameQA.durationMatch,audioStreamParity,audioContentParity:audioQA.contentParity,
    audioEnvelopeDifference:audioQA.envelopeDifference,
    blackFrames:frameQA.blackFrames,flashFrames:frameQA.flashFrames,
    fullFrameParity:frameQA.fullFrameParity,checkedFrameCount:frameQA.checkedFrameCount,
    firstLastNotBlack:frameQA.firstLastNotBlack,boundariesNotBlack:frameQA.boundariesNotBlack,
    noExcessFlashing:frameQA.noExcessFlashing,
    maxFrameDifference:frameQA.maxFrameDifference,p95FrameDifference:frameQA.p95FrameDifference,
  }
  const report={...data,audioWindows:{preview:audioQA.previewWindows,render:audioQA.renderWindows},
    cautions:['All output frames are decoded at 30 fps and compared after RGB downsample',
      'Full-resolution glyph shaping/contrast and semantic beat quality still require rendered review',
      'Input soundtrack identity remains pinned by the fixture SHA-256 and Batch 5 schedule'],
  }
  save(join(directory,'media-qa',candidate.id+'.json'),report)
  return data
}

/**
 * Stable, worker-ready edits and pinned media handoff; does not claim to render.
 * A shard and a single preview use the exact same Batch 3/B5 compiler path.
 */
function preparePreviewRequest(c:B8Candidate,fixtures:FixtureManifest,cacheKey:string):string {
    const images=fixtures.media.filter(m=>m.kind==='image')
    const videos=fixtures.media.filter(m=>m.kind==='video')
    if(!images.length||!videos.length)throw new Error('Preview needs both real photos and video fixtures')
    if(!fixtures.soundtrack)
      throw new Error('Batch 8 full-motion preview needs licensed pinned beat-time music')
    const beatSync=syncB8FamilyToMusic(c.family,fixtures.soundtrack.decision.schedule)
    const media:Record<string,TemplateAsset>={}
    beatSync.family.slots.forEach((slot,i)=>{
      const required=slot.durationFrames+(slot.handles?.headFrames??0)+
        (slot.handles?.tailFrames??0)
      const video=videos.find(v=>(v.durationFrames??0)>=required)
      const source=i%2===0||!video?images[i%images.length]!:video
      media[slot.id]={id:source.id,kind:source.kind,license:source.license,
        ...(source.durationFrames?{durationFrames:source.durationFrames}:{})}
    })
    if(!Object.values(media).some(asset=>asset.kind==='video'))
      throw new Error('No verified video is long enough for a beat-synced slot and both handles')
    // Video sources must begin after authored incoming source handles; images can hold
    // without advancing media time. Never render a clip at 0 with missing handles.
    const sampledFamily={...beatSync.family,slots:beatSync.family.slots.map(slot=>({
      ...slot,...(media[slot.id]?.kind==='video'
        ? {sourceInFrame:slot.handles?.headFrames??0} : {}),
    }))}
    const duration=templateFrameToMs(sampledFamily.totalFrames)
    const edits=compileTemplateWithMusic(sampledFamily,c.design,{
      instanceId:'b8_qa_'+c.familyId,media,music:fixtures.soundtrack.asset,
      templateMusic:fixtures.soundtrack.decision,
    },{durationFrames:sampledFamily.totalFrames,
      edits:defaultEdits({clipStartMs:0,clipEndMs:duration})})
    const syncedCandidate={...c,family:sampledFamily}
    const syncedLegibility=lintB8Legibility(syncedCandidate)
    const syncedBlocks=syncedLegibility.filter(finding=>finding.severity==='block')
    if(syncedBlocks.length)
      throw new Error('Beat-synced template failed legibility: '+
        syncedBlocks.map(finding=>finding.field+':'+finding.code).join(','))
    const editableIssues=auditB8EditableOutput(syncedCandidate,edits,{
      requireMusic:true,expectedMusicAssetId:fixtures.soundtrack.asset.id,
    })
    if(editableIssues.length)
      throw new Error('Prepared edit lost native template structure: '+editableIssues.join(','))
    const dest=join(directory,'preview-requests',c.id+'.json')
    save(dest,{v:1,cacheKey,status:'worker_render_required',designId:c.id,definitionHash:c.definitionHash,
      footage:fixtures.media.filter(f=>Object.values(media).some(a=>a.id===f.id)),
      soundtrack:fixtures.soundtrack,edits:edits.edits,
      authoredStructuralProof:proveB8Structure(c),
      renderTiming:{v:1,totalFrames:sampledFamily.totalFrames,
        boundaries:beatSync.newBoundaries,
        musicScheduleSha256:createHash('sha256')
          .update(JSON.stringify(fixtures.soundtrack.decision.schedule)).digest('hex')},
      beatSync:{oldBoundaries:beatSync.oldBoundaries,newBoundaries:beatSync.newBoundaries,
        movedBoundaries:beatSync.movedBoundaries,allCutsOnPinnedBeats:true},
      legibilityReview:syncedLegibility,
      authoring:{family:sampledFamily,design:c.design,choices:{
        media,music:fixtures.soundtrack.asset,templateMusic:fixtures.soundtrack.decision,
      }},
      editableProof:{
        slotSegments:edits.edits.sourceSegments?.length??0,
        cutBoundaries:edits.edits.videoSplits?.length??0,
        transitions:edits.edits.transitions?.length??0,
        animatedLayers:edits.edits.textItems?.filter(layer=>Boolean(layer.anim)).length??0,
        videoMotionTracks:edits.edits.keyframes?.filter(track=>track.target==='video').length??0,
        separateMusicTrack:Boolean(edits.edits.audio?.music),
        beatSyncedCuts:true,issues:editableIssues,
      },
      expectedAudioTrack:true,expectedMusicSourceSha256:fixtures.soundtrack.sha256,
      message:'Submit registered assets and this ClipEditsV2 plan to the existing worker. No MP4 is claimed by this command.'})
    return dest
}
function pinnedHashes(fixtures:FixtureManifest):string[] {
  return [...fixtures.media.map(m=>m.sha256),
    ...(fixtures.soundtrack?[fixtures.soundtrack.sha256,
      createHash('sha256').update(JSON.stringify(fixtures.soundtrack.decision)).digest('hex')]:[])]
}

type PreparedB8WorkerRequest={
  v:1;cacheKey:string;designId:string;definitionHash:string
  footage:Fixture[]
  renderTiming:{v:1;totalFrames:number;boundaries:number[];musicScheduleSha256:string}
  authoring:{
    family:TemplateFamilyV1
    design:TemplateDesignV1
    choices:{media:Record<string,TemplateAsset>;music:TemplateAsset;templateMusic:TemplateMusicDecisionV1}
  }
  edits:ClipEditsV2
}
type RemotePublished={data:{instanceId:string;projectId:string;clipId:string}}
type RemoteProjectStatus={data:{status:string;error?:string|null;primaryClipId?:string|null}}
type RemoteClipDetail={data:{edits:ClipEditsV2;mediaUrls:{preview?:string|null}}}
type RemoteExport={data:{renderId:string;status:string;downloadUrl?:string|null}}
type RemoteRender={data:{status:string;downloadUrl?:string|null;error?:string|null}}

function extractPoster(renderFile:string,posterFile:string,totalFrames:number){
  mkdirSync(dirname(posterFile),{recursive:true})
  const at=Math.max(0,Math.floor(totalFrames/2)/30)
  const output=spawnSync('ffmpeg',['-nostdin','-y','-v','error','-ss',at.toFixed(3),
    '-i',renderFile,'-frames:v','1','-vf','scale=480:-2:flags=lanczos',posterFile],{
      encoding:'utf8',timeout:60000,maxBuffer:1024*1024,
    })
  if(output.status!==0||!existsSync(posterFile))
    throw new Error('FFmpeg could not extract a poster from actual worker output')
}
function remoteBaseUrl(){
  return argument('--base-url',process.env.B8_QA_BASE_URL??'')
}
function remoteTimeoutMs(){
  const seconds=Number(argument('--timeout-sec','1800'))
  if(!Number.isFinite(seconds)||seconds<30||seconds>21600)
    throw new Error('--timeout-sec must be between 30 and 21600')
  return Math.round(seconds*1000)
}
function remotePollMs(){
  const ms=Number(argument('--poll-ms','3000'))
  if(!Number.isFinite(ms)||ms<500||ms>30000)
    throw new Error('--poll-ms must be between 500 and 30000')
  return Math.round(ms)
}
function machineEvidenceBase(
  c:B8Candidate,request:PreparedB8WorkerRequest,fixtures:FixtureManifest,
  outputs:B8Evidence['outputs'],
):B8Evidence{
  return {
    id:c.id,definitionHash:c.definitionHash,
    reference:{url:b8ReferenceForFamily(c.familyId).url,
      accessDate:b8ReferenceForFamily(c.familyId).accessDate,mediaKind:'photo_video'},
    fixtures:{
      images:request.footage.filter(row=>row.kind==='image').map(row=>row.id),
      videos:request.footage.filter(row=>row.kind==='video').map(row=>row.id),
      licenseHashes:[...new Set([...request.footage.map(row=>row.sha256),
        ...(fixtures.soundtrack?[fixtures.soundtrack.sha256]:[])])],
    },
    outputs,renderTiming:request.renderTiming,
    checks:{
      fullFrameStructure:true,durationMatch:false,audioParity:false,beatAligned:true,
      firstLastNotBlack:false,boundariesNotBlack:false,sampledFrameParity:false,
      glyphsPresent:false,contrastReadable:false,safeZones:false,layerRetention:true,
      rightsCleared:false,noExcessFlashing:false,actualWorkerRender:true,
    },
    reviewer:'',reviewDate:'',
    scores:{pacing:0,beatSemantic:0,transition:0,typography:0,motion:0,color:0},
  }
}
function mergeMachineEvidence(next:B8Evidence){
  const existing=existsSync(evidencePath)?readJSON<B8Evidence[]>(evidencePath):[]
  if(!Array.isArray(existing))throw new Error('Evidence file must be an array')
  const previous=existing.find(row=>row.id===next.id)
  const sameRender=Boolean(previous&&
    previous.outputs?.previewSha256===next.outputs.previewSha256&&
    previous.outputs?.renderSha256===next.outputs.renderSha256)
  const humanChecks=sameRender&&previous?{
    glyphsPresent:Boolean(previous.checks?.glyphsPresent),
    contrastReadable:Boolean(previous.checks?.contrastReadable),
    safeZones:Boolean(previous.checks?.safeZones),
    rightsCleared:Boolean(previous.checks?.rightsCleared),
  }:{glyphsPresent:false,contrastReadable:false,safeZones:false,rightsCleared:false}
  const merged:B8Evidence={...next,checks:{...next.checks,...humanChecks},
    ...(sameRender&&previous?.reference?.url?{reference:previous.reference}:{}),
    ...(sameRender&&previous?.reviewer?{reviewer:previous.reviewer,reviewDate:previous.reviewDate,
      scores:previous.scores}:{}),
    ...(sameRender&&previous?.independentReviewer?{independentReviewer:previous.independentReviewer}:{}),
    ...(sameRender&&previous?.flagged!=null?{flagged:previous.flagged}:{})}
  save(evidencePath,[...existing.filter(row=>row.id!==next.id),merged]
    .sort((a,b)=>a.id.localeCompare(b.id)))
  return merged
}
async function runRemoteWorkerJob(
  c:B8Candidate,fixtures:FixtureManifest,job:B8QueueJobState,remote:B8RemoteConfig,
){
  const started=performance.now()
  const requestPath=preparePreviewRequest(c,fixtures,job.cacheKey)
  const request=readJSON<PreparedB8WorkerRequest>(requestPath)
  if(request.cacheKey!==job.cacheKey||request.definitionHash!==job.definitionHash)
    throw new Error('Prepared worker request is stale')
  const publishStarted=performance.now()
  const published=await b8ApiJson<RemotePublished>(remote,'/api/clips/video-templates/publish',{
    method:'POST',body:JSON.stringify({
      idempotencyKey:'b8qa_'+job.cacheKey.slice(0,32),title:'B8 QA '+c.id,
      family:request.authoring.family,design:request.authoring.design,
      choices:request.authoring.choices,
    }),
  })
  const publishMs=Math.round(performance.now()-publishStarted)
  const timeoutMs=remoteTimeoutMs(),pollMs=remotePollMs()
  const previewStarted=performance.now()
  await b8Poll<RemoteProjectStatus>({
    read:()=>b8ApiJson(remote,'/api/clips/projects/'+encodeURIComponent(published.data.projectId)+'/status'),
    done:value=>value.data.status==='READY',
    failed:value=>['FAILED','CANCELED'].includes(value.data.status)
      ? value.data.error||value.data.status:null,
    timeoutMs,pollMs,label:'template carrier/preview '+c.id,
  })
  const previewReadyMs=Math.round(performance.now()-previewStarted)
  const detail=await b8ApiJson<RemoteClipDetail>(
    remote,'/api/clips/clips/'+encodeURIComponent(published.data.clipId))
  if(!detail.data.mediaUrls.preview)throw new Error('Worker finished without a real preview MP4')
  const expected=compileTemplateWithMusic(request.authoring.family,request.authoring.design,{
    instanceId:published.data.instanceId,...request.authoring.choices,
  },{durationFrames:request.renderTiming.totalFrames,
    edits:defaultEdits({clipStartMs:0,clipEndMs:templateFrameToMs(request.renderTiming.totalFrames)})})
  const persistedAudit=auditB8EditableOutput({...c,family:request.authoring.family},
    {...expected,edits:detail.data.edits},{
      requireMusic:true,expectedMusicAssetId:request.authoring.choices.music.id,
    })
  if(persistedAudit.length)
    throw new Error('Server persisted a non-editable template result: '+persistedAudit.join(','))
  const root='/templates/b8-qa/'+c.id
  const previewUrl=root+'/preview.mp4',renderUrl=root+'/render.mp4',posterUrl=root+'/poster.png'
  await b8Download(remote,detail.data.mediaUrls.preview,fileInPublic(previewUrl))
  const exportStarted=performance.now()
  const exportResult=await b8ApiJson<RemoteExport>(
    remote,'/api/clips/clips/'+encodeURIComponent(published.data.clipId)+'/export',{
      method:'POST',body:JSON.stringify({resolution:'720p',aspect:request.authoring.family.aspects[0],
        watermark:false,format:'mp4',codec:'h264',quality:'standard',fps:30,
        edits:detail.data.edits}),
    })
  let ready=exportResult.data
  if(ready.status!=='READY'||!ready.downloadUrl){
    const polled=await b8Poll<RemoteRender>({
      read:()=>b8ApiJson(remote,'/api/clips/renders/'+encodeURIComponent(exportResult.data.renderId)),
      done:value=>value.data.status==='READY'&&Boolean(value.data.downloadUrl),
      failed:value=>value.data.status==='FAILED'?value.data.error||'render failed':null,
      timeoutMs,pollMs,label:'template export '+c.id,
    })
    ready={...ready,...polled.data}
  }
  if(!ready.downloadUrl)throw new Error('Worker export completed without a download URL')
  const exportReadyMs=Math.round(performance.now()-exportStarted)
  const downloadQaStarted=performance.now()
  const renderFile=fileInPublic(renderUrl)
  await b8Download(remote,ready.downloadUrl,renderFile)
  extractPoster(renderFile,fileInPublic(posterUrl),request.renderTiming.totalFrames)
  const outputs:B8Evidence['outputs']={
    previewMp4:previewUrl,renderMp4:renderUrl,poster:posterUrl,
    previewSha256:await shaFile(fileInPublic(previewUrl)),
    renderSha256:await shaFile(renderFile),
    posterSha256:await shaFile(fileInPublic(posterUrl)),
  }
  let evidence=machineEvidenceBase(c,request,fixtures,outputs)
  const qa=await qaMedia(c,evidence)
  evidence={...evidence,checks:{...evidence.checks,
    durationMatch:qa.durationMatch,
    audioParity:qa.audioStreamParity&&qa.audioContentParity,
    firstLastNotBlack:qa.firstLastNotBlack,boundariesNotBlack:qa.boundariesNotBlack,
    sampledFrameParity:qa.fullFrameParity,noExcessFlashing:qa.noExcessFlashing,
  },flagged:!(qa.durationMatch&&qa.audioStreamParity&&qa.audioContentParity&&
    qa.firstLastNotBlack&&qa.boundariesNotBlack&&qa.fullFrameParity&&qa.noExcessFlashing)}
  const merged=mergeMachineEvidence(evidence)
  const evidenceFile=join(directory,'render-evidence',c.id+'.json')
  const downloadAndQaMs=Math.round(performance.now()-downloadQaStarted)
  const totalMs=Math.round(performance.now()-started)
  save(evidenceFile,{v:1,cacheKey:job.cacheKey,projectId:published.data.projectId,
    clipId:published.data.clipId,renderId:exportResult.data.renderId,evidence:merged,
    timings:{publishMs,previewReadyMs,exportReadyMs,downloadAndQaMs,totalMs},
    note:'Actual worker media + machine QA. Human review fields remain false/empty until inspected.'})
  return evidenceFile
}

async function execute(){
  if(command==='author'){
    save(join(directory,'family-schedules.json'),{v:1,source:'batch8-canonical-v1',families:FACTORY_FAMILY_SEEDS})
    save(join(directory,'curated-treatments.json'),{v:1,treatments:FACTORY_TREATMENTS})
    console.log('Authored 50 canonical families and 40 explicit treatments; none released.')
  }else if(command==='expand'){
    for(const c of candidates)save(join(directory,'candidates',c.familyId,c.id+'.json'),c)
    console.log('Wrote '+candidates.length+' deterministic DRAFT candidates; no public releases.')
  }else if(command==='validate'){
    const start=performance.now()
    const errors:Array<{id:string;message:string}>=[]
    const lint:Record<string,ReturnType<typeof lintB8Legibility>>={}
    let blocked=0,warnings=0
    for(const c of candidates){
      try{proveB8Structure(c)}catch(e){
        errors.push({id:c.id,message:e instanceof Error?e.message:String(e)})
      }
      const findings=lintB8Legibility(c)
      if(findings.length)lint[c.id]=findings
      blocked+=findings.filter(f=>f.severity==='block').length
      warnings+=findings.filter(f=>f.severity==='review').length
    }
    save(join(directory,'legibility-report.json'),{engine:B8_ENGINE_REVISION,
      candidates:candidates.length,hardFailures:blocked,reviewWarnings:warnings,
      findings:lint,requiresRenderedGlyphAndContrastQA:true})
    save(join(directory,'structural-report.json'),{engine:B8_ENGINE_REVISION,defined:candidates.length,
      compiled:candidates.length-errors.length,rendered:0,released:0,
      hardLegibilityFailures:blocked,unresolvedLegibilityReviewWarnings:warnings,
      ms:Math.round(performance.now()-start),errors})
    console.log('Compiled '+(candidates.length-errors.length)+'/'+candidates.length+
      ' candidate structures. '+blocked+' static blockers, '+warnings+
      ' rendered-legibility reviews needed.')
    if(errors.length||blocked)process.exitCode=1
  }else if(command==='preview'){
    const c=requiredCandidate(),fixtures=await verifiedFixtures()
    const cacheKey=shardB8Jobs([c],{hashes:pinnedHashes(fixtures),
      rendererRevision:fixtures.rendererRevision})[0]!.cacheKey
    const dest=preparePreviewRequest(c,fixtures,cacheKey)
    console.log('Wrote compiler/worker preview request '+dest+' (NOT an MP4).')
  }else if(command==='prepare-shard'){
    // Emit one immutable worker request per queued job. Never claim a render
    // succeeded or mutate the running/failed/done checkpoint in this operation.
    const fixtures=await verifiedFixtures()
    if(!fixtures.soundtrack)throw new Error('Pinned licensed soundtrack required')
    const settings=readJSON<{shardCount:number}>(join(directory,'limits.json'))
    const queue=loadQueue()
    const all=args.includes('--all')
    const hasShard=args.includes('--shard')
    const shard=Number(argument('--shard','-1'))
    if(all===hasShard||!Number.isInteger(settings.shardCount)||
       settings.shardCount<1||settings.shardCount>256||
       (hasShard&&(!Number.isInteger(shard)||shard<0||shard>=settings.shardCount)))
      throw new Error('Choose --all or --shard N within the queued shard range')
    const planned=shardB8Jobs(candidates,{hashes:pinnedHashes(fixtures),
      rendererRevision:fixtures.rendererRevision},settings.shardCount)
    const expected=new Map(planned.map(j=>[j.id,j]))
    const available=queue.filter(j=>j.runStatus==='queued'&&(all||j.shard===shard))
    const limit=Number(argument('--limit',String(Math.max(available.length,1))))
    if(!Number.isInteger(limit)||limit<1||limit>2000)
      throw new Error('Request batch limit must be an integer 1..2000')
    const selected=available.slice(0,limit)
    // Fail the whole requested batch on a stale cache key BEFORE writing files.
    for(const job of selected){
      const plan=expected.get(job.id)
      if(!plan||plan.cacheKey!==job.cacheKey||plan.definitionHash!==job.definitionHash)
        throw new Error('Job inputs changed since checkpoint; re-run jobs first: '+job.id)
    }
    const prepared=selected.map(job=>{
      const c=index.get(job.id)!
      const request=preparePreviewRequest(c,fixtures,job.cacheKey)
      return {id:job.id,shard:job.shard,cacheKey:job.cacheKey,request,
        status:'worker_render_required' as const}
    })
    const manifest=join(directory,'prepared',all?'all.json':'shard-'+shard+'.json')
    save(manifest,{v:1,rendererRevision:fixtures.rendererRevision,
      prepared:prepared.length,requests:prepared,
      note:'Compiled worker requests only; no MP4, frame QA, render completion or release is implied.'})
    console.log('Prepared '+prepared.length+' pinned worker requests: '+manifest)
  }else if(command==='qa-media'){
    const c=requiredCandidate()
    const evidence=await verifiedEvidence(false)
    const e=evidence.find(item=>item.id===c.id)
    if(!e)throw new Error('Real render and preview evidence are required')
    const report=await qaMedia(c,e)
    console.log(JSON.stringify({id:c.id,durationMatch:report.durationMatch,
      audioStreamParity:report.audioStreamParity,audioContentParity:report.audioContentParity,
      blackFrames:report.blackFrames.length,flashFrames:report.flashFrames.length,
      fullFrameParity:report.fullFrameParity,checkedFrames:report.checkedFrameCount},null,2))
    if(!report.durationMatch||!report.audioStreamParity||!report.audioContentParity||
       !report.firstLastNotBlack||!report.boundariesNotBlack||
       !report.fullFrameParity||!report.noExcessFlashing)process.exitCode=1
  }else if(command==='qa-all'){
    const evidence=await verifiedEvidence(false)
    let passed=0,failed=0
    const results:Array<{id:string;ok:boolean;error?:string}>=[]
    for(const e of evidence){
      const c=index.get(e.id)
      if(!c)continue
      try{
        const result=await qaMedia(c,e)
        const ok=result.durationMatch&&result.audioStreamParity&&result.audioContentParity&&
          result.firstLastNotBlack&&result.boundariesNotBlack&&result.fullFrameParity&&
          result.noExcessFlashing
        results.push({id:c.id,ok});if(ok)passed++;else failed++
      }catch(error){
        failed++;results.push({id:c.id,ok:false,error:error instanceof Error?error.message:String(error)})
      }
    }
    save(join(directory,'media-qa','all.json'),{v:1,qaRevision:B8_RENDER_QA_REVISION,
      candidatesWithEvidence:evidence.length,passed,failed,results})
    console.log('Full-frame media QA: '+passed+' passed, '+failed+' failed.')
    if(failed)process.exitCode=1
  }else if(command==='jobs'){
    const fixtures=await verifiedFixtures()
    const shardCount=Number(argument('--shards','16'))
    if(!fixtures.soundtrack)throw new Error('Cannot prepare full-motion jobs without pinned licensed music')
    const planned=shardB8Jobs(candidates,{hashes:pinnedHashes(fixtures),
      rendererRevision:fixtures.rendererRevision},shardCount)
    const jobs=withQueueLock(()=>{
      const existing=existsSync(join(directory,'jobs.json'))?loadQueue():[]
      const merged=reconcileB8Queue(planned,existing)
      save(join(directory,'jobs.json'),merged)
      save(join(directory,'limits.json'),{maxConcurrent:2,cpusPerJob:2,ramMiBPerJob:4096,
        diskGiBPerJob:8,maxAttempts:3,checkpoint:'jobs.json',shardCount})
      return merged
    })
    console.log('Reconciled '+jobs.length+' content-addressed jobs; '+
      jobs.filter(j=>j.runStatus==='done').length+' completed, '+
      jobs.filter(j=>j.runStatus==='rendered').length+' rendered, and '+
      jobs.filter(j=>j.runStatus==='running').length+' active leases preserved.')
  }else if(command==='render-queue'){
    const fixtures=await verifiedFixtures()
    if(!fixtures.soundtrack)throw new Error('Pinned licensed soundtrack required')
    const remote=b8RemoteConfig(remoteBaseUrl())
    const settings=readJSON<{shardCount:number;maxConcurrent:number}>(join(directory,'limits.json'))
    const all=args.includes('--all'),hasShard=args.includes('--shard')
    const shard=Number(argument('--shard','-1'))
    if(all===hasShard||(hasShard&&(!Number.isInteger(shard)||shard<0||shard>=settings.shardCount)))
      throw new Error('Choose exactly one of --all or --shard N')
    const initial=loadQueue()
    const available=initial.filter(job=>job.runStatus==='queued'&&(all||job.shard===shard))
    const limit=Number(argument('--limit',String(available.length)))
    if(!Number.isInteger(limit)||limit<1||limit>2000)throw new Error('--limit must be 1..2000')
    const selected=available.slice(0,limit)
    let cursor=0,rendered=0,failed=0
    const concurrency=Math.min(2,Math.max(1,Number(settings.maxConcurrent)||2))
    const worker=async()=>{
      for(;;){
        const job=selected[cursor++]
        if(!job)return
        const claimed=withQueueLock(()=>{
          const jobs=loadQueue(),row=jobs.find(item=>item.id===job.id)
          if(!row||row.runStatus!=='queued'||row.attempts>=3||
             jobs.filter(item=>item.runStatus==='running').length>=concurrency)return false
          row.runStatus='running';row.attempts++;row.claimedAt=new Date().toISOString()
          delete row.error;delete row.renderEvidence;save(join(directory,'jobs.json'),jobs);return true
        })
        if(!claimed){failed++;continue}
        try{
          const c=index.get(job.id)
          if(!c)throw new Error('Unknown Batch 8 candidate')
          const evidenceFile=await runRemoteWorkerJob(c,fixtures,job,remote)
          withQueueLock(()=>{
            const jobs=loadQueue(),row=jobs.find(item=>item.id===job.id)
            if(!row||row.runStatus!=='running')throw new Error('Render checkpoint changed during worker run')
            row.runStatus='rendered';row.renderEvidence=evidenceFile;delete row.error
            save(join(directory,'jobs.json'),jobs)
          })
          rendered++
        }catch(error){
          const message=(error instanceof Error?error.message:String(error)).slice(0,500)
          withQueueLock(()=>{
            const jobs=loadQueue(),row=jobs.find(item=>item.id===job.id)
            if(row&&row.runStatus==='running'){row.runStatus='failed';row.error=message}
            save(join(directory,'jobs.json'),jobs)
          })
          failed++
        }
      }
    }
    await Promise.all(Array.from({length:concurrency},()=>worker()))
    console.log('Remote worker queue: '+rendered+' rendered/QA checkpointed, '+failed+' failed.')
    if(failed)process.exitCode=1
  }else if(['claim','cancel','fail','retry','resume','complete'].includes(command)){
    const completedEvidence=command==='complete'?await verifiedEvidence():[]
    withQueueLock(()=>{
      const jobs=loadQueue(),id=args[1],job=id?jobs.find(j=>j.id===id):undefined
      if(command!=='resume'&&!job)throw new Error('Job ID is required')
      if(command==='resume'){
        for(const j of jobs)if(j.runStatus==='failed'&&j.attempts<3){
          j.runStatus='queued';delete j.error;delete j.claimedAt;delete j.renderEvidence
        }
      }else if(job){
        if(command==='claim'){
          if(job.runStatus!=='queued'||job.attempts>=3||
             jobs.filter(j=>j.runStatus==='running').length>=2)throw new Error('Job lease unavailable')
          job.runStatus='running';job.attempts++;job.claimedAt=new Date().toISOString()
        }else if(command==='cancel'){
          if(job.runStatus==='running'||job.runStatus==='rendered'||job.runStatus==='done')
            throw new Error('Running/rendered work cannot be canceled without worker/evidence cleanup')
          job.runStatus='canceled'
        }else if(command==='fail'){
          if(job.runStatus!=='running')throw new Error('Job is not claimed')
          job.runStatus='failed';job.error='See worker log/checkpoint'
        }else if(command==='retry'){
          if(job.runStatus!=='failed'||job.attempts>=3)throw new Error('Retry limit reached')
          job.runStatus='queued';delete job.error;delete job.claimedAt;delete job.renderEvidence
        }else if(command==='complete'){
          if(job.runStatus!=='running'&&job.runStatus!=='rendered')
            throw new Error('Job needs a claimed/rendered checkpoint to finish')
          const e=completedEvidence.find(row=>row.id===job.id)
          const candidate=index.get(job.id)
          if(!candidate||!e||auditB8Evidence(candidate,e).length)
            throw new Error('Job cannot be completed without actual hashed worker output and passing review evidence')
          job.runStatus='done';delete job.error;delete job.claimedAt
        }
      }
      save(join(directory,'jobs.json'),jobs)
      console.log(command+' checkpoint saved')
    })
  }else if(command==='review-packet'){
    const evidence=await verifiedEvidence(false)
    const byId=new Map(evidence.map(row=>[row.id,row]))
    const packet=candidates.map(c=>{
      const ref=b8ReferenceForFamily(c.familyId),e=byId.get(c.id)
      return {id:c.id,familyId:c.familyId,treatmentId:c.treatmentId,
        reference:ref,
        render:e?.outputs?.renderMp4??null,poster:e?.outputs?.poster??null,
        renderSha256:e?.outputs?.renderSha256??null,
        machineChecks:e?.checks??null,
        review:{
          reviewer:e?.reviewer??'',reviewDate:e?.reviewDate??'',
          scores:e?.scores??{pacing:null,beatSemantic:null,transition:null,typography:null,motion:null,color:null},
          independentReviewer:e?.independentReviewer??'',
          threshold:'>=9/10 overall and every dimension >=4/5',
        }}
    })
    save(join(directory,'review-packet.json'),{v:1,generatedAt:new Date().toISOString(),
      designs:packet.length,packet})
    console.log('Wrote '+packet.length+' pinned competitor review rows; no score was fabricated.')
  }else if(command==='quality-report'||command==='release-manifest'||command==='contact-sheet'){
    const evidence=await verifiedEvidence()
    const report=reportB8Quality(candidates,evidence)
    save(join(directory,'quality-report.json'),report)
    if(command==='release-manifest'){
      const released=locallyApprovedB8Releases(candidates,evidence)
      save(join(directory,'release-manifest.local.json'),{v:1,generatedAt:new Date().toISOString(),
        releaseCount:released.length,releases:released,
        warning:'LOCAL ONLY. Coordinator must separately approve runtime publication.'})
      console.log('Local release manifest contains '+released.length+' actual reviewed renders')
    }else if(command==='contact-sheet'){
      const approved=new Map(evidence.map(e=>[e.id,e]))
      const escapeHTML=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',
        '"':'&quot;',"'":'&#39;'}[c]!))
      const cards=candidates.map(c=>{
        const e=approved.get(c.id),img=e&&report.releasedIds.includes(c.id)
          ? '<img loading="lazy" src="'+escapeHTML(e.outputs.poster)+'" alt="Render poster" />' : ''
        return '<article><h3>'+escapeHTML(c.id)+'</h3>'+img+
          '<p>'+escapeHTML(report.blockers[c.id]?.join(', ')??'approved')+'</p></article>'
      }).join('\n')
      mkdirSync(directory,{recursive:true})
      writeFileSync(join(directory,'contact-sheet.html'),
        '<!doctype html><html lang="en"><meta charset="utf-8"><title>B8 QA contact sheet</title>'+
        '<style>body{font-family:sans-serif}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:16px}img{max-width:100%}article{padding:12px;border:1px solid #ddd}</style>'+
        '<h1>First-party candidate contact sheet — not a release</h1><main>'+cards+'</main></html>')
      console.log('Contact sheet generated; only actually approved media has image links.')
    }else console.log(JSON.stringify({defined:report.defined,previewed:report.previewed,
      autoRenderPass:report.autoRenderPass,editorReviewed:report.editorReviewed,
      released:report.released,community:report.community},null,2))
  }else if(command==='benchmark-real'){
    const root=join(directory,'render-evidence')
    const rows=existsSync(root)?readdirSync(root).filter(name=>name.endsWith('.json')).flatMap(name=>{
      try{
        const row=readJSON<{timings?:{publishMs:number;previewReadyMs:number;exportReadyMs:number;
          downloadAndQaMs:number;totalMs:number}}>(join(root,name))
        return row.timings?[row.timings]:[]
      }catch{return []}
    }):[]
    if(!rows.length)throw new Error('No actual worker timing evidence exists yet')
    const percentile=(values:number[],p:number)=>{
      const sorted=[...values].sort((a,b)=>a-b)
      return sorted[Math.min(sorted.length-1,Math.max(0,Math.ceil(sorted.length*p)-1))]!
    }
    const metric=(key:keyof (typeof rows)[number])=>{
      const values=rows.map(row=>row[key])
      return {minMs:Math.min(...values),p50Ms:percentile(values,.5),
        p95Ms:percentile(values,.95),maxMs:Math.max(...values),
        meanMs:Math.round(values.reduce((a,b)=>a+b,0)/values.length)}
    }
    const report={kind:'actual_worker_runs',samples:rows.length,
      publish:metric('publishMs'),previewWorker:metric('previewReadyMs'),
      exportWorker:metric('exportReadyMs'),downloadAndFullFrameQA:metric('downloadAndQaMs'),
      total:metric('totalMs')}
    save(join(directory,'benchmark-real.json'),report)
    console.log(JSON.stringify(report,null,2))
  }else if(command==='benchmark'){
    const start=performance.now()
    for(const c of candidates)proveB8Structure(c)
    const ms=Math.round(performance.now()-start)
    save(join(directory,'benchmark.json'),{kind:'compiler_only',candidates:candidates.length,ms,
      warning:'Use benchmark-real after render-queue for measured worker timings.'})
    console.log('Compiler-only '+candidates.length+' designs in '+ms+'ms')
  }else{
    console.log('Commands: author | expand | validate --all | preview <id> --fixtures <file> | jobs --fixtures <file> [--shards N] | prepare-shard (--all | --shard N) [--limit N] | render-queue (--all | --shard N) [--limit N] --base-url <app> | qa-media <id> | qa-all | claim/cancel/fail/retry/resume/complete <id> | review-packet | quality-report | contact-sheet | release-manifest | benchmark | benchmark-real')
  }
}
void execute().catch(e=>{console.error(e instanceof Error?e.message:String(e));process.exitCode=1})
