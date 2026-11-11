#!/usr/bin/env node
/**
 * Batch 8 CLI. Use: pnpm exec tsx scripts/template-factory.ts <command> [args].
 * This CLI never publishes to the runtime gallery. A preview request is NOT a
 * real render: only actual existing worker MP4/PNG plus verified QA can release.
 */
import { createHash } from 'node:crypto'
import { createReadStream, existsSync, mkdirSync, readFileSync, renameSync,
  rmSync, openSync, closeSync, writeFileSync } from 'node:fs'
import { resolve, dirname, join, sep } from 'node:path'
import { performance } from 'node:perf_hooks'
import { spawnSync } from 'node:child_process'
import { FACTORY_FAMILY_SEEDS, FACTORY_TREATMENTS } from '../lib/clips/real-video-templates/b8-authoring-catalog'
import { lintB8Legibility } from '../lib/clips/real-video-templates/b8-legibility'
import { generateB8Candidates, proveB8Structure, reportB8Quality,
  locallyApprovedB8Releases, shardB8Jobs, auditB8Evidence,
  B8_ENGINE_REVISION, type B8Candidate, type B8Evidence } from '../lib/clips/real-video-templates/b8-factory'
import { compileTemplate, templateFrameToMs, type TemplateAsset } from '../lib/clips/real-video-templates/sequence-contract'
import { defaultEdits } from '../lib/clips/edits'

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
type FixtureManifest={v:1;rendererRevision:string;media:Fixture[]}
async function verifiedFixtures():Promise<FixtureManifest>{
  const fixture=readJSON<FixtureManifest>(fixturePath)
  if(fixture.v!==1||!fixture.media?.length||!fixture.rendererRevision)throw new Error('Invalid fixtures')
  const ids=new Set<string>()
  for(const row of fixture.media){
    if(!safeName.test(row.id)||ids.has(row.id)||!HASH.test(row.sha256)||
       !['image','video'].includes(row.kind)||!row.license?.reference||
       !await verifyPublic(row.path,row.sha256))
      throw new Error('Fixture must exist with exact licensed bytes: '+row.id)
    if(row.kind==='video'&&(!Number.isSafeInteger(row.durationFrames)||!row.durationFrames))
      throw new Error('Video fixture needs verified durationFrames: '+row.id)
    ids.add(row.id)
  }
  return fixture
}
type MeasuredRenderQA={
  id:string;definitionHash:string;previewSha256:string;renderSha256:string
  expectedFrames:number;previewFrames:number;renderFrames:number
  previewHasAudio:boolean;renderHasAudio:boolean
  durationMatch:boolean;audioStreamParity:boolean
  blackSampleFrames:number[];frameSampleParity:boolean;sampledFrameCount:number
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
    const matched=Boolean(okay&&measurement&&measurement.id===candidate.id&&
      measurement.definitionHash===candidate.definitionHash&&
      measurement.previewSha256===values.previewSha256&&
      measurement.renderSha256===values.renderSha256&&
      measurement.expectedFrames===candidate.family.totalFrames&&
      measurement.sampledFrameCount>=2*candidate.family.slots.length)
    const valid=Boolean(matched&&measurement&&measurement.durationMatch&&
      measurement.audioStreamParity&&measurement.blackSampleFrames.length===0&&
      measurement.frameSampleParity)
    out.push({...e,checks:{...e.checks,
      durationMatch:requireMeasuredQA?valid:Boolean(e.checks?.durationMatch),
      audioParity:requireMeasuredQA?valid:Boolean(e.checks?.audioParity),
      firstLastNotBlack:requireMeasuredQA?valid:Boolean(e.checks?.firstLastNotBlack),
      boundariesNotBlack:requireMeasuredQA?valid:Boolean(e.checks?.boundariesNotBlack),
      sampledFrameParity:requireMeasuredQA?valid:Boolean(e.checks?.sampledFrameParity),
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
type QueueJob=ReturnType<typeof shardB8Jobs>[number]&{attempts:number;
  runStatus:'queued'|'running'|'failed'|'done'|'canceled';error?:string}
function withQueueLock<T>(fn:()=>T):T {
  mkdirSync(directory,{recursive:true})
  const lock=join(directory,'jobs.lock')
  let handle:number
  try {handle=openSync(lock,'wx')}catch{throw new Error('Another factory scheduler owns jobs.lock')}
  try{return fn()}finally{closeSync(handle);rmSync(lock,{force:true})}
}
function loadQueue():QueueJob[] {return readJSON<QueueJob[]>(join(directory,'jobs.json'))}
type FFProbeResult={format?:{duration?:string};streams?:Array<{codec_type?:string}>}
function probe(file:string):{durationFrames:number;hasAudio:boolean}{
  const output=spawnSync('ffprobe',['-v','error','-show_entries','format=duration',
    '-show_entries','stream=codec_type','-of','json',file],{
      encoding:'utf8',timeout:30000,maxBuffer:1024*1024,
    })
  if(output.status!==0)throw new Error('ffprobe failed on real worker output: '+file)
  const data=JSON.parse(output.stdout) as FFProbeResult
  const duration=Number(data.format?.duration)
  if(!Number.isFinite(duration)||duration<=0)throw new Error('Video metadata has no duration')
  return {durationFrames:Math.round(duration*30),
    hasAudio:Boolean(data.streams?.some(stream=>stream.codec_type==='audio'))}
}
function framePixels(file:string,atFrame:number,durationFrames:number):Buffer{
  const ss=Math.max(0,Math.min((durationFrames-1)/30,atFrame/30))
  const output=spawnSync('ffmpeg',['-nostdin','-v','error','-ss',ss.toFixed(6),
    '-i',file,'-frames:v','1','-vf','scale=64:64:flags=lanczos,format=gray',
    '-f','rawvideo','-pix_fmt','gray','-'],{
      encoding:null,timeout:30000,maxBuffer:65536,
    })
  if(output.status!==0||!Buffer.isBuffer(output.stdout)||output.stdout.length!==4096)
    throw new Error('FFmpeg cannot decode a QA sample frame at '+atFrame)
  return output.stdout
}
const mean=(pixels:Buffer)=>pixels.reduce((a,b)=>a+b,0)/pixels.length
const difference=(a:Buffer,b:Buffer)=>{
  let sum=0
  for(let i=0;i<a.length;i++)sum+=Math.abs(a[i]!-b[i]!)
  return sum/a.length
}
async function qaMedia(candidate:B8Candidate,evidence:B8Evidence){
  const output=evidence.outputs
  if(!output||!await verifyPublic(output.previewMp4,output.previewSha256)||
      !await verifyPublic(output.renderMp4,output.renderSha256))
    throw new Error('No actual hashed preview+render MP4 available for analysis')
  const preview=fileInPublic(output.previewMp4)
  const rendered=fileInPublic(output.renderMp4)
  const pp=probe(preview),pr=probe(rendered)
  const expected=candidate.family.totalFrames
  const boundaries=candidate.family.slots.slice(1).map(slot=>slot.startFrame)
  const samples=[0,expected-1,...boundaries.flatMap(frame=>[frame-1,frame])]
    .filter(frame=>frame>=0&&frame<expected)
  const unique=[...new Set(samples)].sort((a,b)=>a-b)
  const actual:Array<{frame:number;previewMean:number;renderMean:number;difference:number}>=[]
  for(const frame of unique){
    const a=framePixels(preview,frame,pp.durationFrames)
    const b=framePixels(rendered,frame,pr.durationFrames)
    actual.push({frame,previewMean:mean(a),renderMean:mean(b),difference:difference(a,b)})
  }
  const black=actual.filter(row=>row.renderMean<=7||row.previewMean<=7).map(row=>row.frame)
  const parity=actual.every(row=>row.difference<=12)
  const durationMatch=Math.abs(pp.durationFrames-expected)<=1&&
    Math.abs(pr.durationFrames-expected)<=1
  const audioStreamParity=pp.hasAudio===pr.hasAudio
  const data={id:candidate.id,definitionHash:candidate.definitionHash,
    previewSha256:output.previewSha256,renderSha256:output.renderSha256,
    expectedFrames:expected,previewFrames:pp.durationFrames,
    renderFrames:pr.durationFrames,previewHasAudio:pp.hasAudio,renderHasAudio:pr.hasAudio,
    durationMatch,audioStreamParity,blackSampleFrames:black,frameSampleParity:parity,
    sampledFrameCount:actual.length,maxSampleDifference:Math.max(...actual.map(x=>x.difference)),
    samples:actual,
    cautions:['Grayscale comparison is not glyph/color validation',
      'Check flashes at full frame rate, license rights, beat timestamps and full-motion typography manually',
      'Sampling cannot prove all 30 fps frames or source-specific audio ducking parity'],
  }
  save(join(directory,'media-qa',candidate.id+'.json'),data)
  return data
}

async function execute(){
  if(command==='author'){
    save(join(directory,'family-schedules.json'),{v:1,source:'provisional',families:FACTORY_FAMILY_SEEDS})
    save(join(directory,'curated-treatments.json'),{v:1,treatments:FACTORY_TREATMENTS})
    console.log('Authored 50 provisional families and 40 explicit treatments; none released.')
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
    const images=fixtures.media.filter(m=>m.kind==='image')
    const videos=fixtures.media.filter(m=>m.kind==='video')
    if(!images.length||!videos.length)throw new Error('Preview needs both real photos and video fixtures')
    const media:Record<string,TemplateAsset>={}
    c.family.slots.forEach((slot,i)=>{
      const video=videos.find(v=>(v.durationFrames??0)>=slot.durationFrames+12)
      const source=i%2===0||!video?images[i%images.length]!:video
      media[slot.id]={id:source.id,kind:source.kind,license:source.license,
        ...(source.durationFrames?{durationFrames:source.durationFrames}:{})}
    })
    // Video sources must begin after authored incoming source handles; images can hold
    // without advancing media time. Never render a clip at 0 with missing handles.
    const sampledFamily={...c.family,slots:c.family.slots.map(slot=>({
      ...slot,...(media[slot.id]?.kind==='video'
        ? {sourceInFrame:slot.handles?.headFrames??0} : {}),
    }))}
    const duration=templateFrameToMs(c.family.totalFrames)
    const edits=compileTemplate(sampledFamily,c.design,{instanceId:'b8_qa_'+c.familyId,media},
      {durationFrames:c.family.totalFrames,edits:defaultEdits({clipStartMs:0,clipEndMs:duration})})
    const dest=join(directory,'preview-requests',c.id+'.json')
    save(dest,{v:1,status:'worker_render_required',designId:c.id,definitionHash:c.definitionHash,
      footage:fixtures.media.filter(f=>Object.values(media).some(a=>a.id===f.id)),
      edits:edits.edits,expected:proveB8Structure(c),
      message:'Submit registered assets and this ClipEditsV2 plan to the existing worker. No MP4 is claimed by this command.'})
    console.log('Wrote compiler/worker preview request '+dest+' (NOT an MP4).')
  }else if(command==='qa-media'){
    const c=requiredCandidate()
    const evidence=await verifiedEvidence(false)
    const e=evidence.find(item=>item.id===c.id)
    if(!e)throw new Error('Real render and preview evidence are required')
    const report=await qaMedia(c,e)
    console.log(JSON.stringify({id:c.id,durationMatch:report.durationMatch,
      audioStreamParity:report.audioStreamParity,blackFrames:report.blackSampleFrames,
      sampledParity:report.frameSampleParity,samples:report.sampledFrameCount},null,2))
    if(!report.durationMatch||!report.audioStreamParity||
       report.blackSampleFrames.length||!report.frameSampleParity)process.exitCode=1
  }else if(command==='jobs'){
    const fixtures=await verifiedFixtures()
    const shardCount=Number(argument('--shards','16'))
    const jobs=shardB8Jobs(candidates,{hashes:fixtures.media.map(m=>m.sha256),
      rendererRevision:fixtures.rendererRevision},shardCount).map(j=>({...j,attempts:0,
      runStatus:'queued' as const}))
    withQueueLock(()=>save(join(directory,'jobs.json'),jobs))
    save(join(directory,'limits.json'),{maxConcurrent:2,cpusPerJob:2,ramMiBPerJob:4096,
      diskGiBPerJob:8,maxAttempts:3,checkpoint:'jobs.json',shardCount})
    console.log('Queued '+jobs.length+' deterministic cached jobs for existing worker adapter.')
  }else if(['claim','cancel','fail','retry','resume','complete'].includes(command)){
    const completedEvidence=command==='complete'?await verifiedEvidence():[]
    withQueueLock(()=>{
      const jobs=loadQueue(),id=args[1],job=id?jobs.find(j=>j.id===id):undefined
      if(command!=='resume'&&!job)throw new Error('Job ID is required')
      if(command==='resume'){
        for(const j of jobs)if(j.runStatus==='failed'&&j.attempts<3){j.runStatus='queued';delete j.error}
      }else if(job){
        if(command==='claim'){
          if(job.runStatus!=='queued'||job.attempts>=3||
             jobs.filter(j=>j.runStatus==='running').length>=2)throw new Error('Job lease unavailable')
          job.runStatus='running';job.attempts++
        }else if(command==='cancel'){
          if(job.runStatus==='running'||job.runStatus==='done')
            throw new Error('Already-running work needs worker-coordinated cancellation')
          job.runStatus='canceled'
        }else if(command==='fail'){
          if(job.runStatus!=='running')throw new Error('Job is not claimed')
          job.runStatus='failed';job.error='See worker log/checkpoint'
        }else if(command==='retry'){
          if(job.runStatus!=='failed'||job.attempts>=3)throw new Error('Retry limit reached')
          job.runStatus='queued';delete job.error
        }else if(command==='complete'){
          if(job.runStatus!=='running')throw new Error('Job must be claimed to finish')
          const e=completedEvidence.find(row=>row.id===job.id)
          const candidate=index.get(job.id)
          if(!candidate||!e||auditB8Evidence(candidate,e).length)
            throw new Error('Job cannot be completed without actual hashed worker output and passing review evidence')
          job.runStatus='done';delete job.error
        }
      }
      save(join(directory,'jobs.json'),jobs)
      console.log(command+' checkpoint saved')
    })
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
  }else if(command==='benchmark'){
    const start=performance.now()
    for(const c of candidates)proveB8Structure(c)
    const ms=Math.round(performance.now()-start)
    save(join(directory,'benchmark.json'),{kind:'compiler_only',candidates:candidates.length,ms,
      warning:'Actual FFmpeg incremental rerender benchmark requires worker output and fixtures.'})
    console.log('Compiler-only '+candidates.length+' designs in '+ms+'ms')
  }else{
    console.log('Commands: author | expand | validate --all | preview <id> --fixtures <file> | qa-media <id> | jobs --fixtures <file> [--shards N] | claim/cancel/fail/retry/resume <id> | quality-report | contact-sheet | release-manifest | benchmark')
  }
}
void execute().catch(e=>{console.error(e instanceof Error?e.message:String(e));process.exitCode=1})
