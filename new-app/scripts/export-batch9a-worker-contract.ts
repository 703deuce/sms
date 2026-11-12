#!/usr/bin/env tsx
import { createHash } from 'node:crypto'
import { mkdirSync,writeFileSync } from 'node:fs'
import { dirname,join,resolve } from 'node:path'
import { defaultEdits } from '../lib/clips/edits'
import {
  BATCH9A_ANCHOR_RELEASES,
  BATCH9A_DEFAULT_MUSIC,
} from '../lib/clips/real-video-templates/batch9a-anchors'
import { buildBatch9aGrooveV2Wav } from '../lib/clips/real-video-templates/batch9a-groove-audio'
import { compileTemplateWithMusic,type TemplateMusicDecisionV1 } from '../lib/clips/real-video-templates/music-sequence'
import { templateFrameToMs,type TemplateAsset } from '../lib/clips/real-video-templates/sequence-contract'

const out=resolve(process.cwd(),process.argv[2]??'../build/b9a-worker-contract.json')
const musicPath=join(dirname(out),'b9a-cert-music.wav')
const musicBytes=buildBatch9aGrooveV2Wav(BATCH9A_DEFAULT_MUSIC)
const musicSha=createHash('sha256').update(musicBytes).digest('hex')
if(musicSha!==BATCH9A_DEFAULT_MUSIC.sha256)
  throw new Error('Batch 9A production certification music drift')

const mediaLicense={
  id:'wikimedia_cc0_photo_pack_v1',
  provenance:'licensed' as const,
  reference:'wikimedia_cc0_photo_pack_v1',
}
const musicLicense={
  id:'batch9a_first_party_music',
  provenance:'first-party' as const,
  reference:BATCH9A_DEFAULT_MUSIC.revision,
}
const rights={
  assetId:BATCH9A_DEFAULT_MUSIC.id,
  origin:'first-party-generated',
  author:BATCH9A_DEFAULT_MUSIC.author,
  license:BATCH9A_DEFAULT_MUSIC.license,
  revision:BATCH9A_DEFAULT_MUSIC.revision,
  sha256:musicSha,
  commercialUse:true,
  exportAllowed:true,
  redistributionAllowed:true,
  verifiedDurationFrames:BATCH9A_DEFAULT_MUSIC.durationFrames,
  verifiedAt:BATCH9A_DEFAULT_MUSIC.revision,
}
const schedule={
  v:1 as const,
  mode:'beat-time' as const,
  musicAssetId:BATCH9A_DEFAULT_MUSIC.id,
  sha256:musicSha,
  bpm:BATCH9A_DEFAULT_MUSIC.bpm,
  confidence:'manual' as const,
  offsetFrames:0,
  durationFrames:BATCH9A_DEFAULT_MUSIC.durationFrames,
  beats:Array.from(
    {length:Math.ceil(BATCH9A_DEFAULT_MUSIC.durationFrames/BATCH9A_DEFAULT_MUSIC.beatEveryFrames)},
    (_,i)=>i*BATCH9A_DEFAULT_MUSIC.beatEveryFrames,
  ).filter(frame=>frame<BATCH9A_DEFAULT_MUSIC.durationFrames),
  phrases:[],
  protectedAnchors:[],
}
const decision:TemplateMusicDecisionV1={v:1,rights,schedule,choice:'keep-timing'}
const music:TemplateAsset={
  id:BATCH9A_DEFAULT_MUSIC.id,
  kind:'audio',
  durationFrames:BATCH9A_DEFAULT_MUSIC.durationFrames,
  license:musicLicense,
}
const photoManifest={
  path:'worker/tests/fixtures/template_media/b8_cc0_photos.json',
  revision:'b8-cc0-photo-pack-v1',
  license:'CC0-1.0',
} as const
const definitionHash=(release:(typeof BATCH9A_ANCHOR_RELEASES)[number])=>
  createHash('sha256')
    .update(JSON.stringify(['batch9a-live-anchor-v1',release.family,release.design]))
    .digest('hex')

const designs=BATCH9A_ANCHOR_RELEASES.map(release=>{
  const media:Record<string,TemplateAsset>={}
  release.family.slots.forEach((slot,index)=>{
    media[slot.id]={
      id:'b8_image_'+String(index%10),
      kind:'image',
      license:mediaLicense,
    }
  })
  const durationMs=templateFrameToMs(release.family.totalFrames)
  const base=defaultEdits({clipStartMs:0,clipEndMs:durationMs})
  const carrierEdits={
    ...base,
    trim:{in:0,out:durationMs},
    layout:{...base.layout,mode:'full_frame' as const},
    aspectRatio:'9:16' as const,
    captions:{...base.captions,enabled:false},
  }
  const compiled=compileTemplateWithMusic(
    release.family,
    release.design,
    {
      instanceId:'b9a_worker_'+release.id,
      media,
      music,
      templateMusic:decision,
    },
    {durationFrames:release.family.totalFrames,edits:carrierEdits},
  )
  return {
    id:release.id,
    familyId:release.family.familyId,
    treatmentId:'bold',
    definitionHash:definitionHash(release),
    totalFrames:release.family.totalFrames,
    boundaries:[0,...release.family.slots.map(slot=>slot.startFrame+slot.durationFrames)],
    edits:compiled.edits,
  }
})
if(designs.length!==10||new Set(designs.map(row=>row.id)).size!==10)
  throw new Error('Batch 9A production worker contract must contain exactly ten anchors')
mkdirSync(dirname(out),{recursive:true})
writeFileSync(musicPath,musicBytes)
writeFileSync(out,JSON.stringify({
  v:1,
  engine:'batch9a-anchor-production-v1',
  source:'batch9a-live-anchor-v1',
  fps:30,
  fixture:{
    musicId:BATCH9A_DEFAULT_MUSIC.id,
    musicSha,
    musicFile:'b9a-cert-music.wav',
    mediaOrigin:'SHA-1 pinned Wikimedia Commons CC0 photographs',
    photoManifest,
  },
  designs,
},null,2)+'\n')
console.log('Wrote '+designs.length+' live Batch 9A worker contracts to '+out)
