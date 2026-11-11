#!/usr/bin/env tsx
import { createHash } from 'node:crypto'
import { mkdirSync,writeFileSync } from 'node:fs'
import { dirname,join,resolve } from 'node:path'
import { defaultEdits } from '../lib/clips/edits'
import { generateB8Candidates,B8_ENGINE_REVISION } from '../lib/clips/real-video-templates/b8-factory'
import { syncB8FamilyToMusic } from '../lib/clips/real-video-templates/b8-music-sync'
import { compileTemplateWithMusic,type TemplateMusicDecisionV1 } from '../lib/clips/real-video-templates/music-sequence'
import { templateFrameToMs,type TemplateAsset } from '../lib/clips/real-video-templates/sequence-contract'

const out=resolve(process.cwd(),process.argv[2]??'../build/real-video-templates/b8/worker-contract.json')
const musicPath=join(dirname(out),'b8-cert-music.wav')
function certificationWav(seconds=60,sampleRate=8000):Buffer{
  const samples=seconds*sampleRate,bytes=Buffer.alloc(44+samples*2)
  bytes.write('RIFF',0);bytes.writeUInt32LE(36+samples*2,4);bytes.write('WAVE',8)
  bytes.write('fmt ',12);bytes.writeUInt32LE(16,16);bytes.writeUInt16LE(1,20)
  bytes.writeUInt16LE(1,22);bytes.writeUInt32LE(sampleRate,24)
  bytes.writeUInt32LE(sampleRate*2,28);bytes.writeUInt16LE(2,32);bytes.writeUInt16LE(16,34)
  bytes.write('data',36);bytes.writeUInt32LE(samples*2,40)
  for(let i=0;i<samples;i++){
    const phase=(i*220/sampleRate)%1
    bytes.writeInt16LE(phase<0.5?2400:-2400,44+i*2)
  }
  return bytes
}
const musicBytes=certificationWav()
const musicId='b8_factory_cert_music'
const musicSha=createHash('sha256').update(musicBytes).digest('hex')
const rights={
  assetId:musicId,origin:'first-party-generated',author:'Transovo AI',
  license:'Transovo first-party internal certification fixture',revision:'b8-cert-v1',
  sha256:musicSha,commercialUse:true,exportAllowed:true,redistributionAllowed:false,
  verifiedDurationFrames:1800,verifiedAt:'2026-11-11',
}
const schedule={
  v:1 as const,mode:'beat-time' as const,musicAssetId:musicId,sha256:musicSha,
  bpm:150,confidence:'high' as const,offsetFrames:0,durationFrames:1800,
  beats:Array.from({length:150},(_,i)=>i*12),phrases:[],protectedAnchors:[],
}
const decision:TemplateMusicDecisionV1={v:1,rights,schedule,choice:'keep-timing'}
const license={id:'batch9a_first_party_qa',provenance:'first-party' as const,
  reference:'batch9a_first_party_qa_v1'}
const music:TemplateAsset={id:musicId,kind:'audio',durationFrames:1800,license}
const previewSprites=[
  {file:'f01_bold.webp',sha256:'58ef2a887bda559f694d9e4672959a1ef75f7fb0af1dcbf6ce41f1efd2c122e5'},
  {file:'f02_bold.webp',sha256:'7a8145775fa34ceddf8c47e2c839cae871adffc43a5ae1a73c958fc193ac5c63'},
  {file:'f03_bold.webp',sha256:'279d895fb616d1f84a51214d771ce952fee78966a8a70cf5a319ffd69af38606'},
  {file:'f04_bold.webp',sha256:'3ed78acee0174b631acf0d065ab535ed3038d9fdd10438a5d30c06f2c2a5bac1'},
  {file:'f05_bold.webp',sha256:'26b57939e0f759966163379d39d9aa558cc9db18dd30b7e3b772af8418142e26'},
  {file:'f06_bold.webp',sha256:'ccd5f1e9f987b9d2c2097cf5f0a58eb9ae74ce578e1f94f276efd26f01917fa1'},
  {file:'f07_bold.webp',sha256:'03e79394ded98bbc6768bb05467c075894ff8ea4c072b0c9dcb936f7d3b69bb5'},
  {file:'f08_bold.webp',sha256:'17e030a72dcb7d710a596d0caa52e89cb4b60f3c7cd4916eaa0ce812637500e1'},
  {file:'f09_bold.webp',sha256:'45c9052aa72c277a00590dd1c8ca1ee54835643e088cc88fa219ba8a2f3af264'},
  {file:'f10_bold.webp',sha256:'bde7dc5f35299e825341937fcc8861c49fa7b05bac54eade599994a63ec65de9'},
] as const

const designs=generateB8Candidates().map(candidate=>{
  const beat=syncB8FamilyToMusic(candidate.family,schedule)
  const media:Record<string,TemplateAsset>={}
  const slots=beat.family.slots.map((slot,index)=>{
    const video=index%3===1
    const asset:TemplateAsset=video
      ? {id:'b8_video_'+String(index%10),kind:'video',durationFrames:1800,license}
      : {id:'b8_image_'+String(index%10),kind:'image',license}
    media[slot.id]=asset
    return video?{...slot,sourceInFrame:slot.handles?.headFrames??0}:slot
  })
  const family={...beat.family,slots}
  const durationMs=templateFrameToMs(family.totalFrames)
  const base=defaultEdits({clipStartMs:0,clipEndMs:durationMs})
  const carrierEdits={
    ...base,
    trim:{in:0,out:durationMs},
    layout:{...base.layout,mode:'full_frame' as const},
    aspectRatio:'9:16' as const,
    captions:{...base.captions,enabled:false},
  }
  const compiled=compileTemplateWithMusic(family,candidate.design,{
    instanceId:'b8_worker_'+candidate.id,media,music,templateMusic:decision,
  },{durationFrames:family.totalFrames,edits:carrierEdits})
  return {
    id:candidate.id,familyId:candidate.familyId,treatmentId:candidate.treatmentId,
    definitionHash:candidate.definitionHash,totalFrames:family.totalFrames,
    boundaries:[0,...family.slots.map(slot=>slot.startFrame+slot.durationFrames)],
    edits:compiled.edits,
  }
})
if(designs.length!==2000)throw new Error('Batch 8 worker contract must contain 2000 designs')
mkdirSync(dirname(out),{recursive:true})
writeFileSync(musicPath,musicBytes)
writeFileSync(out,JSON.stringify({
  v:1,engine:B8_ENGINE_REVISION,source:'batch8-canonical-v1',fps:30,
  fixture:{musicId,musicSha,musicFile:'b8-cert-music.wav',
    mediaOrigin:'Batch 9A first-party preview sprites',previewSprites},
  designs,
})+'\n')
console.log('Wrote '+designs.length+' Batch 8 worker contracts to '+out+
  ' with pinned music '+musicSha)
