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
const musicLicense={id:'b8_first_party_music_qa',provenance:'first-party' as const,
  reference:'b8_generated_cert_music_v1'}
const mediaLicense={id:'wikimedia_cc0_photo_pack_v1',provenance:'licensed' as const,
  reference:'CC0-1.0 https://creativecommons.org/publicdomain/zero/1.0/'}
const music:TemplateAsset={id:musicId,kind:'audio',durationFrames:1800,license:musicLicense}
const photoManifest={
  path:'worker/tests/fixtures/template_media/b8_cc0_photos.json',
  revision:'b8-cc0-photo-pack-v1',
  license:'CC0-1.0',
} as const

const designs=generateB8Candidates().map(candidate=>{
  const beat=syncB8FamilyToMusic(candidate.family,schedule)
  const media:Record<string,TemplateAsset>={}
  const slots=beat.family.slots.map((slot,index)=>{
    const video=index%3===1
    const asset:TemplateAsset=video
      ? {id:'b8_video_'+String(index%10),kind:'video',durationFrames:240,license:mediaLicense}
      : {id:'b8_image_'+String(index%10),kind:'image',license:mediaLicense}
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
    mediaOrigin:'SHA-1 pinned Wikimedia Commons CC0 photographs; video slots are motion derivatives',
    photoManifest},
  designs,
})+'\n')
console.log('Wrote '+designs.length+' Batch 8 worker contracts to '+out+
  ' with pinned music '+musicSha)
