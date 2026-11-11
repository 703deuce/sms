import { describe, expect, it } from 'vitest'
import {
  compileTemplateWithMusic, planTemplateMusic,
  type TemplateMusicDecisionV1,
} from '@/lib/clips/real-video-templates/music-sequence'
import {
  pinMusicSchedule, type AudioLicenseRecord,
} from '@/lib/clips/real-video-templates/music-timing'
import {
  TEMPLATE_STOCK_AUDIO_AUDIT_V1, requireClearedTemplateStockAudio,
} from '@/lib/clips/real-video-templates/music-license-manifest'
import type {
  TemplateFamilyV1, TemplateChoices, TemplateDesignV1,
} from '@/lib/clips/real-video-templates/sequence-contract'
import type { ClipEditsV2 } from '@/lib/clips/edits'

const sha = 'a'.repeat(64)
const rights: AudioLicenseRecord = {
  assetId:'upload_music', origin:'uploaded-soundtrack', author:'Creator',
  license:'user-owned', revision:'ack:2026-11-11', sha256:sha,
  commercialUse:true,exportAllowed:true,redistributionAllowed:false,
  verifiedDurationFrames:3600, verifiedAt:'2026-11-11',
}
const makeSchedule = (bpm:number) => pinMusicSchedule({
  assetId: 'upload_music', license:rights, mode:'beat-time',
  grid:{bpm,beatsMs:Array.from({length:130},(_,i)=>i*60000/bpm)},
})
const family = (n:number):TemplateFamilyV1 => ({
  schemaVersion:1,familyId:'b5_family',revision:1,title:'B5 test',
  tags:['shorts'],aspects:['9:16'],fps:30,totalFrames:n*30,
  slots:Array.from({length:n},(_,i)=>({
    id:'shot_'+i,ordinal:i+1,role:'support' as const,media:'image' as const,
    startFrame:i*30,durationFrames:30,fit:'cover' as const,
    sourceAudio:'mute' as const,transition:'cut' as const,
  })),
  texts:[{id:'headline',defaultText:'My own writing',maxChars:80,startFrame:0,
    durationFrames:n*30,x:50,y:20,font:'Anton',size:64,color:'#FFFFFF'}],
  graphics:[{id:'shape',type:'rounded',startFrame:0,durationFrames:n*30,
    x:50,y:65,w:150,h:40,color:'#112233'}],
  beatAnchors:[0,15,30],
})
const design:TemplateDesignV1 = {
  schemaVersion:1,designId:'b5_design',revision:1,
  stylePackId:'style_b5',familyId:'b5_family',familyRevision:1,
  musicPolicy:'licensed-only',
}
const photo = {
  id:'photo_one',kind:'image' as const,
  license:{id:'license_1',provenance:'user-owned' as const,reference:'owned'},
}
const decision = (choice:'keep-timing'|'re-sync'='keep-timing'):TemplateMusicDecisionV1 => ({
  v:1,rights,schedule:makeSchedule(90),originalSchedule:makeSchedule(120),
  choice,
})
const choices = (n:number,d:TemplateMusicDecisionV1):TemplateChoices & {
  templateMusic:TemplateMusicDecisionV1
} => ({
  instanceId:'instance_b5',
  media:Object.fromEntries(Array.from({length:n},(_,i)=>['shot_'+i,photo])),
  music:{id:'upload_music',kind:'audio',durationFrames:3600,
    license:{id:'rights1',provenance:'user-owned',reference:'owned'}},
  templateMusic:d,
})
const carrier=(n:number):{durationFrames:number;edits:ClipEditsV2}=>({
  durationFrames:n,edits:{v:2,trim:{in:0,out:Math.round(n*1000/30)},
    cutRanges:[],wordFixes:{},captions:{},layout:{mode:'full_frame',shotOverrides:[]}} as ClipEditsV2,
})

describe('Batch 5 template music preview and shared renderer compiler',()=>{
  it('keeps all authored cuts/text/graphics and disables implicit loop',()=>{
    const r=compileTemplateWithMusic(family(2),design,choices(2,decision()),carrier(60))
    expect(r.sequence.totalFrames).toBe(60)
    expect(r.edits.audio?.music).toMatchObject({
      loop:false,endMs:2000,fadeInMs:500,fadeOutMs:1000,uploadId:'upload_music',
    })
    expect(r.edits.textItems?.find(x=>x.text==='My own writing')).toMatchObject({startMs:0,endMs:2000})
    expect(r.edits.textItems?.find(x=>x.kind==='shape')).toMatchObject({startMs:0,endMs:2000})
    expect(r.edits.sourceSegments?.map(x=>[x.startMs,x.endMs])).toEqual([[0,1000],[1000,2000]])
  })
  it('maps 120 to 90 BPM in one accepted resync for 30 repeated slots with no drift',()=>{
    const p=planTemplateMusic(family(30),decision('re-sync'))
    expect(p.durationFrames).toBe(1200)
    expect(p.preview.movedBoundaries).toBeGreaterThan(1)
    const r=compileTemplateWithMusic(family(30),design,choices(30,decision('re-sync')),carrier(1200))
    expect(r.sequence.items).toHaveLength(30)
    expect(r.sequence.items.at(-1)?.outputEndFrame).toBe(1200)
    expect(r.edits.sourceSegments?.at(-1)?.endMs).toBe(40000)
    expect(r.edits.textItems?.find(x=>x.text==='My own writing')?.endMs).toBe(40000)
    expect(r.edits.audio?.music?.endMs).toBe(40000)
    expect(new Set(r.edits.sources?.map(s=>s.id)).size).toBe(1)
    expect(r.edits.inserts).toBeUndefined()
    const boundaries=r.sequence.items.map(x=>[x.outputStartFrame,x.outputEndFrame])
    expect(boundaries.every(([start,end],i)=>end-start>=9 && (i===0||start===boundaries[i-1]![1]))).toBe(true)
  })
  it('does not pitch-shift source audio when music is replaced',()=>{
    const f=family(2)
    f.slots=f.slots.map(s=>({...s,media:'video',sourceAudio:'source'}))
    const opts=choices(2,decision('re-sync'))
    opts.media=Object.fromEntries(f.slots.map(s=>[s.id,{...photo,
      id:'video_source',kind:'video',durationFrames:180}]))
    const r=compileTemplateWithMusic(f,design,opts,carrier(80))
    expect(r.edits.sourceSegments?.map(x=>x.audio)).toEqual(['source','source'])
    expect(r.edits.sourceSegments?.every(x=>x.speed===undefined)).toBe(true)
    expect(r.edits.audio?.music?.duckDepth).toBe(0.65)
  })
  it('lets ambient or silent licensed beds keep fixed time, never fake a beat resync',()=>{
    const ambient={...family(2),beatAnchors:[]}
    const silent=pinMusicSchedule({assetId:'upload_music',license:rights,
      mode:'fixed-time',grid:{bpm:0,beatsMs:[]}})
    const d:TemplateMusicDecisionV1={v:1,rights,schedule:silent,choice:'keep-timing'}
    expect(planTemplateMusic(ambient,d).durationFrames).toBe(60)
    expect(()=>planTemplateMusic(ambient,{...d,choice:'re-sync',originalSchedule:makeSchedule(120)}))
      .toThrow(/beat-time/)
    expect(()=>planTemplateMusic(family(2),d)).toThrow(/Beat-driven/)
  })
  it('refuses no rights, inconsistent hashes, short songs, and unapproved loops',()=>{
    const input=choices(2,decision())
    expect(()=>compileTemplateWithMusic(family(2),design,{...input,templateMusic:undefined},carrier(60)))
      .toThrow(/rights.*pinned/)
    expect(()=>planTemplateMusic(family(2),{...decision(),rights:{...rights,sha256:'b'.repeat(64)}}))
      .toThrow(/hash/)
    const short={...decision(),schedule:{...makeSchedule(90),durationFrames:30}}
    expect(()=>planTemplateMusic(family(2),short)).toThrow(/duration/)
    expect(()=>planTemplateMusic(family(2),{...decision('keep-timing'),
      rights:{...rights,verifiedDurationFrames:30},
      schedule:{...makeSchedule(90),durationFrames:30,beats:[0,20]},
    })).toThrow(/short/)
  })
  it('never treats unverified legacy stock catalog references as export-cleared',()=>{
    expect(TEMPLATE_STOCK_AUDIO_AUDIT_V1).toHaveLength(10)
    for(const row of TEMPLATE_STOCK_AUDIO_AUDIT_V1)
      expect(()=>requireClearedTemplateStockAudio(row.id,{sha256:sha,durationFrames:60})).toThrow(/not cleared/)
    const rec={...TEMPLATE_STOCK_AUDIO_AUDIT_V1[0]!,status:'verified' as const,
      sha256:sha,verifiedDurationFrames:60,commercialUse:true,exportAllowed:true}
    const yes=requireClearedTemplateStockAudio(rec.id,{sha256:sha,durationFrames:60},[rec])
    expect(yes.exportAllowed).toBe(true)
    expect(()=>requireClearedTemplateStockAudio(rec.id,{sha256:'b'.repeat(64),durationFrames:60},[rec]))
      .toThrow(/differ/)
  })
})
