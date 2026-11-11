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
import { FACTORY_FAMILY_SEEDS, FACTORY_TREATMENTS } from '../lib/clips/real-video-templates/b8-authoring-catalog'
import { generateB8Candidates, proveB8Structure, reportB8Quality,
  locallyApprovedB8Releases, shardB8Jobs, auditB8Evidence, B8_TARGET,
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
async function verifiedEvidence():Promise<B8Evidence[]> {
  const evidence=existsSync(evidencePath)?readJSON<B8Evidence[]>(evidencePath):[]
  if(!Array.isArray(evidence))throw new Error('Evidence file must be an array')
  const out:B8Evidence[]=[]
  for(const e of evidence){
    if(!index.has(e.id))throw new Error('Evidence for unknown candidate '+e.id)
    const values=e.outputs
    const okay=Boolean(values && await verifyPublic(values.previewMp4,values.previewSha256) &&
      await verifyPublic(values.renderMp4,values.renderSha256) &&
      await verifyPublic(values.poster,values.posterSha256))
    out.push({...e,checks:{...e.checks,
      actualWorkerRender:Boolean(okay && e.checks?.actualWorkerRender===true)}})
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
    for(const c of candidates)try{proveB8Structure(c)}catch(e){
      errors.push({id:c.id,message:e instanceof Error?e.message:String(e)})
    }
    save(join(directory,'structural-report.json'),{engine:B8_ENGINE_REVISION,defined:candidates.length,
      compiled:candidates.length-errors.length,rendered:0,released:0,
      ms:Math.round(performance.now()-start),errors})
    console.log('Compiled '+(candidates.length-errors.length)+'/'+candidates.length+' candidates, '+errors.length+' errors.')
    if(errors.length)process.exitCode=1
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
    const duration=templateFrameToMs(c.family.totalFrames)
    const edits=compileTemplate(c.family,c.design,{instanceId:'b8_qa_'+c.familyId,media},
      {durationFrames:c.family.totalFrames,edits:defaultEdits({clipStartMs:0,clipEndMs:duration})})
    const dest=join(directory,'preview-requests',c.id+'.json')
    save(dest,{v:1,status:'worker_render_required',designId:c.id,definitionHash:c.definitionHash,
      footage:fixtures.media.filter(f=>Object.values(media).some(a=>a.id===f.id)),
      edits:edits.edits,expected:proveB8Structure(c),
      message:'Submit registered assets and this ClipEditsV2 plan to the existing worker. No MP4 is claimed by this command.'})
    console.log('Wrote compiler/worker preview request '+dest+' (NOT an MP4).')
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
          if(job.runStatus==='done')throw new Error('Cannot cancel completed QA')
          job.runStatus='canceled'
        }else if(command==='fail'){
          if(job.runStatus!=='running')throw new Error('Job is not claimed')
          job.runStatus='failed';job.error='See worker log/checkpoint'
        }else if(command==='retry'){
          if(job.runStatus!=='failed'||job.attempts>=3)throw new Error('Retry limit reached')
          job.runStatus='queued';delete job.error
        }else if(command==='complete'){
          throw new Error('Complete requires verified render evidence; use quality-report and release-manifest, not a manual success toggle')
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
    console.log('Commands: author | expand | validate --all | preview <id> --fixtures <file> | jobs --fixtures <file> [--shards N] | claim/cancel/fail/retry/resume <id> | quality-report | contact-sheet | release-manifest | benchmark')
  }
}
void execute().catch(e=>{console.error(e instanceof Error?e.message:String(e));process.exitCode=1})
