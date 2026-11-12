#!/usr/bin/env node
import { createHash } from 'node:crypto'
import { copyFileSync,existsSync,mkdirSync,readFileSync,writeFileSync } from 'node:fs'
import { dirname,resolve } from 'node:path'
import { defaultEdits } from '../lib/clips/edits'
import {
  BATCH9_PHASE_B_VARIANT_TARGET,batch9PhaseAAnchorGate,batch9PhaseBExpansionCandidates,
} from '../lib/clips/real-video-templates/batch9-phase-b'
import { compileTemplateWithMusic,type TemplateMusicDecisionV1 } from '../lib/clips/real-video-templates/music-sequence'
import { templateFrameToMs,type TemplateAsset } from '../lib/clips/real-video-templates/sequence-contract'
import type { B8Evidence } from '../lib/clips/real-video-templates/b8-factory'

const args=process.argv.slice(2)
const value=(name:string,fallback:string)=>{
  const i=args.indexOf(name)
  return i>=0&&args[i+1]?args[i+1]!:fallback
}
const evidencePath=resolve(process.cwd(),value('--evidence','build/real-video-templates/b9a/evidence.json'))
const sourcePath=resolve(process.cwd(),value('--source','../build/b8-worker-contract.json'))
const outPath=resolve(process.cwd(),value('--out','../build/b9-phase-b-worker-contract.json'))
if(!existsSync(evidencePath))throw new Error('Phase B worker contract requires Phase A evidence: '+evidencePath)
const evidence=JSON.parse(readFileSync(evidencePath,'utf8')) as B8Evidence[]
const gate=batch9PhaseAAnchorGate(evidence)
if(!gate.ready)throw new Error('Phase B render multiplication blocked until all ten live anchors are certified')
const source=JSON.parse(readFileSync(sourcePath,'utf8')) as {
  v:number;engine:string;fps:number
  fixture:{musicId:string;musicSha:string;musicFile:string;realVideoFixture:unknown;mediaOrigin:string}
  designs:Array<{id:string}>
}
if(source.v!==1||source.fps!==30||!Array.isArray(source.designs)||source.designs.length!==2000)
  throw new Error('Expected the complete Batch 8 2,000-design worker contract')
if(!source.fixture?.musicId||!/^[a-f0-9]{64}$/i.test(source.fixture.musicSha))
  throw new Error('Phase B requires the pinned Batch 8 certification soundtrack bytes')

const musicFrames=1800
const license={id:'b9_phase_b_first_party_qa',provenance:'first-party' as const,
  reference:'b9_phase_b_checked_in_real_media_v1'}
const rights={
  assetId:source.fixture.musicId,origin:'first-party-generated',author:'Transovo AI',
  license:'Transovo first-party internal certification fixture',revision:'b9-phase-b-cert-v1',
  sha256:source.fixture.musicSha,commercialUse:true,exportAllowed:true,
  redistributionAllowed:false,verifiedDurationFrames:musicFrames,verifiedAt:'2026-11-11',
}
const schedule={
  v:1 as const,mode:'beat-time' as const,musicAssetId:source.fixture.musicId,
  sha256:source.fixture.musicSha,bpm:150,confidence:'high' as const,
  offsetFrames:0,durationFrames:musicFrames,
  beats:Array.from({length:600},(_,i)=>i*3),phrases:[],protectedAnchors:[],
}
const decision:TemplateMusicDecisionV1={v:1,rights,schedule,choice:'keep-timing'}
const music:TemplateAsset={id:source.fixture.musicId,kind:'audio',durationFrames:musicFrames,license}

const designs=batch9PhaseBExpansionCandidates().map(candidate=>{
  const media:Record<string,TemplateAsset>={}
  const slots=candidate.family.slots.map((slot,index)=>{
    const video=index%3===1
    const asset:TemplateAsset=video
      ? {id:'b8_video_'+String(index%10),kind:'video',durationFrames:musicFrames,license}
      : {id:'b8_image_'+String(index%10),kind:'image',license}
    media[slot.id]=asset
    return video?{...slot,sourceInFrame:slot.handles?.headFrames??0}:slot
  })
  const family={...candidate.family,slots}
  const durationMs=templateFrameToMs(family.totalFrames)
  const base=defaultEdits({clipStartMs:0,clipEndMs:durationMs})
  const carrierEdits={...base,trim:{in:0,out:durationMs},
    layout:{...base.layout,mode:'full_frame' as const},aspectRatio:'9:16' as const,
    captions:{...base.captions,enabled:false}}
  const compiled=compileTemplateWithMusic(family,candidate.design,{
    instanceId:'b9b_worker_'+candidate.id,media,music,templateMusic:decision,
  },{durationFrames:family.totalFrames,edits:carrierEdits})
  return {
    id:candidate.id,familyId:candidate.familyId,treatmentId:candidate.treatmentId,
    definitionHash:candidate.definitionHash,totalFrames:family.totalFrames,
    boundaries:[0,...family.slots.map(slot=>slot.startFrame+slot.durationFrames)],
    edits:compiled.edits,
  }
})
if(designs.length!==BATCH9_PHASE_B_VARIANT_TARGET||
   new Set(designs.map(row=>row.id)).size!==BATCH9_PHASE_B_VARIANT_TARGET)
  throw new Error('Phase B contract did not compile exactly 390 unique live-anchor variants')
const sourceMusic=resolve(dirname(sourcePath),source.fixture.musicFile)
if(!existsSync(sourceMusic))throw new Error('Missing pinned Phase B soundtrack bytes: '+sourceMusic)
const musicBytes=readFileSync(sourceMusic)
const musicSha=createHash('sha256').update(musicBytes).digest('hex')
if(musicSha!==source.fixture.musicSha)
  throw new Error('Phase B soundtrack bytes do not match the pinned contract SHA-256')
mkdirSync(dirname(outPath),{recursive:true})
const outMusic=resolve(dirname(outPath),source.fixture.musicFile)
if(outMusic!==sourceMusic)copyFileSync(sourceMusic,outMusic)
writeFileSync(outPath,JSON.stringify({
  v:1,phase:'batch9-phase-b-live-anchor-v2',sourceEngine:source.engine,fps:source.fps,
  fixture:{...source.fixture,mediaOrigin:'Phase B real-photo/video certification fixture'},
  phaseAAnchorsCertified:true,designs,
},null,2)+'\n')
console.log('Wrote '+designs.length+' live-anchor Phase B worker rows to '+outPath)
