import { describe,expect,it } from 'vitest'
import { summarizeB8AudioEnvelopeQA,summarizeB8FrameQA } from '@/lib/clips/real-video-templates/b8-render-qa'
import { syncB8FamilyToMusic } from '@/lib/clips/real-video-templates/b8-music-sync'
import { FACTORY_FAMILY_SEEDS,FACTORY_TREATMENTS } from '@/lib/clips/real-video-templates/b8-authoring-catalog'
import { lintB8Legibility } from '@/lib/clips/real-video-templates/b8-legibility'
import { B8_TARGET,generateB8Candidates,proveB8Structure,reportB8Quality,
  auditB8EditableOutput,auditB8Evidence,scoreB8Review,shardB8Jobs,reconcileB8Queue,locallyApprovedB8Releases,
  type B8Evidence } from '@/lib/clips/real-video-templates/b8-factory'
import { validateTemplateFamily, templateFrameToMs } from '@/lib/clips/real-video-templates/sequence-contract'
import { compileTemplateWithMusic } from '@/lib/clips/real-video-templates/music-sequence'
import { pinMusicSchedule } from '@/lib/clips/real-video-templates/music-timing'
import { defaultEdits } from '@/lib/clips/edits'
const candidates=generateB8Candidates()
const hash='a'.repeat(64)
function evidence(id:string):B8Evidence{
  return {
    id,reference:{url:'https://www.canva.com/templates/',accessDate:'2026-11-11',mediaKind:'photo_video'},
    fixtures:{images:['original_image'],videos:['original_video'],licenseHashes:[hash]},
    outputs:{previewMp4:'/templates/real-preview.mp4',renderMp4:'/templates/real-render.mp4',
      poster:'/templates/real-poster.webp',previewSha256:hash,renderSha256:hash,posterSha256:hash},
    renderTiming:{v:1,totalFrames:candidates.find(c=>c.id===id)?.family.totalFrames??210,
      boundaries:[0,...(candidates.find(c=>c.id===id)?.family.slots.map(s=>s.startFrame+s.durationFrames)??[210])],
      musicScheduleSha256:hash},
    checks:{fullFrameStructure:true,durationMatch:true,audioParity:true,beatAligned:true,
      firstLastNotBlack:true,boundariesNotBlack:true,sampledFrameParity:true,
      glyphsPresent:true,contrastReadable:true,safeZones:true,layerRetention:true,
      rightsCleared:true,noExcessFlashing:true,actualWorkerRender:true},
    reviewer:'Fixture reviewer only',reviewDate:'2026-11-11',
    scores:{pacing:5,beatSemantic:5,transition:5,typography:5,motion:5,color:5},
  }
}
describe('Batch 8 candidate-only authoring and release QA',()=>{
  it('has exactly 50 authored structural schedules and 25+15 explicit treatments',()=>{
    expect(FACTORY_FAMILY_SEEDS).toHaveLength(50)
    expect(FACTORY_TREATMENTS.filter(t=>t.kind==='core')).toHaveLength(25)
    expect(FACTORY_TREATMENTS.filter(t=>t.kind==='alternate')).toHaveLength(15)
    expect(candidates).toHaveLength(B8_TARGET.candidateTotal)
    expect(new Set(candidates.map(c=>c.id)).size).toBe(2000)
    expect(candidates.every(c=>c.status==='draft'&&c.authoringOrigin==='provisional')).toBe(true)
  })
  it('preserves authored family rhythms and the thirty-slot variant',()=>{
    const first=candidates.find(c=>c.id==='f01_bold')!
    const long=candidates.find(c=>c.id==='f50_bold')!
    expect(first.family.slots.map(x=>x.durationFrames)).toEqual([45,45,60,60])
    expect(first.family.slots.map(x=>x.role)).toEqual(['hero','support','detail','closing'])
    expect(long.family.slots).toHaveLength(30)
    expect(long.family.totalFrames).toBe(540)
  })
  it('compiles every generated candidate into original media cuts, native transitions and layers',()=>{
    for(const c of candidates){
      const proof=proveB8Structure(c)
      expect(proof.slotItems,c.id).toBe(c.family.slots.length)
      expect(proof.videoCuts,c.id).toBe(c.family.slots.length-1)
      expect(proof.textItems,c.id).toBe(c.family.texts.length+(c.family.graphics?.length??0))
      expect(proof.musicPresent).toBe(false)
      expect(proof.compilationHash).toMatch(/^[a-f0-9]{64}$/)
    }
  })
  it('requires alternate text hierarchy, placement and choreography to be visually authored',()=>{
    for(const alt of FACTORY_TREATMENTS.filter(t=>t.kind==='alternate')){
      const parent=FACTORY_TREATMENTS.find(t=>t.id===alt.parentId)!
      const differences=[
        alt.headingFont!==parent.headingFont||alt.supportFont!==parent.supportFont,
        alt.x!==parent.x||alt.y!==parent.y,alt.enter!==parent.enter,
        alt.graphic!==parent.graphic||alt.gx!==parent.gx||alt.gy!==parent.gy,
        alt.transition!==parent.transition,
      ].filter(Boolean).length
      expect(differences,alt.id).toBeGreaterThanOrEqual(3)
    }
  })
  it('accepts only pinned vendored fonts, never arbitrarily supplied names',()=>{
    const first=candidates[0]!
    expect(validateTemplateFamily(first.family)).toBeTruthy()
    expect(()=>validateTemplateFamily({...first.family,
      texts:first.family.texts.map((t,i)=>i? t:{...t,font:'file:///tmp/arbitrary.ttf'})}))
      .toThrow('pinned licensed font')
  })
  it('fails closed with no actual video/QA evidence and never advertises 2000 releases',()=>{
    const report=reportB8Quality(candidates,[])
    expect(report.defined).toBe(2000)
    expect(report.familyCount).toBe(50)
    expect(report.released).toBe(0)
    expect(report.community).toBe(0)
    expect(locallyApprovedB8Releases(candidates,[])).toHaveLength(0)
  })
  it('requires all first 10 anchors, 9/10 overall and >=4 in every rubric dimension',()=>{
    const c=candidates[0]!,e=evidence(c.id)
    expect(scoreB8Review(e)).toEqual({score:10,minimum:true})
    expect(auditB8Evidence(c,e)).toEqual([])
    expect(reportB8Quality(candidates,[e]).released).toBe(0)
    expect(reportB8Quality(candidates,[e]).blockers[c.id]).toContain('first_ten_anchor_gate')
    e.scores.transition=3.99
    expect(auditB8Evidence(c,e)).toContain('qa_score_below_nine_or_dimension_below_four')
    e.scores.transition=5
    e.checks.actualWorkerRender=false
    expect(auditB8Evidence(c,e)).toContain('unverified_render_quality_or_rights')
  })
  it('flags Unicode/RTL glyph fallback and moving-background contrast without claiming rendered QA',()=>{
    const candidate=candidates.find(c=>c.id==='f01_bold')!
    const checks=lintB8Legibility(candidate)
    expect(checks.some(c=>c.code==='unicode_fallback_required')).toBe(true)
    expect(checks.some(c=>c.code==='rendered_contrast_needed')).toBe(true)
    expect(checks.every(c=>c.severity==='block'||c.severity==='review')).toBe(true)
    const altered={...candidate,family:{...candidate.family,texts:candidate.family.texts.map(
      (text,i)=>i===0?{...text,defaultText:'A'.repeat(70)}:text)}}
    expect(lintB8Legibility(altered).some(c=>c.code==='default_overflow')).toBe(true)
    const userText=lintB8Legibility(candidate,{headline:'A'.repeat(100)})
    expect(userText.some(c=>c.code==='text_over_max_chars'&&c.severity==='block')).toBe(true)
    expect(userText.some(c=>c.code==='default_overflow')).toBe(true)
    expect(lintB8Legibility(candidate,{headline:''}).some(c=>c.code==='empty_text')).toBe(true)
    expect(lintB8Legibility(candidate).some(c=>c.code.startsWith('low_contrast_on_'))).toBe(true)
    expect(auditB8Evidence(altered,evidence(altered.id))).toContain('unresolved_static_legibility')
  })
  it('retimes all 50 structures onto real pinned music beats without changing slot order',()=>{
    const schedule={
      v:1 as const,mode:'beat-time' as const,musicAssetId:'grid',sha256:hash,bpm:120,
      confidence:'high' as const,offsetFrames:0,durationFrames:3600,
      beats:Array.from({length:240},(_,i)=>i*15),
      phrases:[],protectedAnchors:[],
    }
    for(const candidate of candidates.filter(c=>c.treatmentId==='bold')){
      const synced=syncB8FamilyToMusic(candidate.family,schedule)
      const beats=new Set(schedule.beats)
      expect(synced.family.slots.map(s=>s.id)).toEqual(candidate.family.slots.map(s=>s.id))
      expect(synced.family.slots.slice(1).every(s=>beats.has(s.startFrame)),candidate.id).toBe(true)
      expect(beats.has(synced.family.totalFrames),candidate.id).toBe(true)
      expect(synced.family.slots.every(s=>s.durationFrames>=9),candidate.id).toBe(true)
      expect(lintB8Legibility({...candidate,family:synced.family})
        .filter(finding=>finding.severity==='block'),candidate.id).toEqual([])
    }
  })
  it('keeps B4 mixed sources and B5 pinned music as separate edit lanes',()=>{
    const c=candidates.find(c=>c.id==='f01_bold')!
    const baseSchedule={
      v:1 as const,mode:'beat-time' as const,musicAssetId:'music_fixture',sha256:hash,bpm:120,
      confidence:'high' as const,offsetFrames:0,durationFrames:600,
      beats:Array.from({length:40},(_,i)=>i*15),phrases:[],protectedAnchors:[],
    }
    const synced=syncB8FamilyToMusic(c.family,baseSchedule).family
    const family={...synced,slots:synced.slots.map((slot,i)=>
      i===1?{...slot,sourceInFrame:6}:slot)}
    const license={id:'fixture_owned',provenance:'user-owned' as const,reference:'test-only'}
    const media=Object.fromEntries(family.slots.map((slot,i)=>[slot.id,i===1?
      {id:'video_one',kind:'video' as const,durationFrames:300,license}:
      {id:'image_one',kind:'image' as const,license}]))
    const rights={assetId:'music_fixture',origin:'first-party-test',author:'Test only',
      license:'first-party',revision:'1',sha256:hash,commercialUse:true,
      exportAllowed:true,redistributionAllowed:false,
      verifiedDurationFrames:600,verifiedAt:'2026-11-11'}
    const schedule=pinMusicSchedule({assetId:'music_fixture',license:rights,
      mode:'beat-time',grid:{bpm:120,beatsMs:Array.from({length:40},(_,i)=>i*500)}})
    const duration=templateFrameToMs(family.totalFrames)
    const result=compileTemplateWithMusic(family,c.design,{
      instanceId:'b8_music_preview',media,
      music:{id:'music_fixture',kind:'audio',durationFrames:600,license},
      templateMusic:{v:1,rights,schedule,choice:'keep-timing'},
    },{durationFrames:family.totalFrames,
      edits:defaultEdits({clipStartMs:0,clipEndMs:duration})})
    expect(result.sequence.items).toHaveLength(family.slots.length)
    expect(result.edits.sourceSegments).toHaveLength(family.slots.length)
    expect(result.edits.sources?.some(s=>s.refId==='video_one')).toBe(true)
    expect(result.edits.textItems).toHaveLength(family.texts.length+(family.graphics?.length??0))
    expect(result.edits.transitions).toHaveLength(family.slots.length-1)
    expect(result.edits.audio?.music).toMatchObject({uploadId:'music_fixture',loop:false,
      endMs:duration,fadeInMs:500,fadeOutMs:1000})
    expect(result.edits.inserts).toBeUndefined()
    expect(auditB8EditableOutput(c,result,{
      requireMusic:true,expectedMusicAssetId:'music_fixture',
    })).toEqual([])
    const broken={...result,edits:{...result.edits,
      videoSplits:result.edits.videoSplits?.slice(1),
      textItems:result.edits.textItems?.map((layer,i)=>i?layer:{...layer,anim:undefined}),
      audio:{...result.edits.audio,music:null},
    }}
    expect(auditB8EditableOutput(c,broken,{
      requireMusic:true,expectedMusicAssetId:'music_fixture',
    })).toEqual(expect.arrayContaining([
      'editable_cut_boundaries','animated_layer_loss','separate_music_track_missing',
    ]))
  })
  it('checks every decoded RGB frame, cut boundary, flash reversal and audio envelope',()=>{
    const width=2,height=1,frameBytes=width*height*3
    const frame=(v:number)=>Uint8Array.from(Array(frameBytes).fill(v))
    const concat=(frames:Uint8Array[])=>{
      const out=new Uint8Array(frames.length*frameBytes)
      frames.forEach((f,i)=>out.set(f,i*frameBytes))
      return out
    }
    const stable=concat([frame(30),frame(40),frame(50),frame(60)])
    const close=concat([frame(31),frame(41),frame(51),frame(61)])
    const good=summarizeB8FrameQA({previewRgb:stable,renderRgb:close,width,height,
      expectedFrames:4,boundaryFrames:[2]})
    expect(good.checkedFrameCount).toBe(4)
    expect(good.fullFrameParity).toBe(true)
    expect(good.blackFrames).toEqual([])
    expect(good.noExcessFlashing).toBe(true)
    const flashing=concat([frame(20),frame(220),frame(20),frame(30)])
    const bad=summarizeB8FrameQA({previewRgb:flashing,renderRgb:flashing,width,height,
      expectedFrames:4,boundaryFrames:[2]})
    expect(bad.flashFrames).toEqual([1])
    expect(bad.noExcessFlashing).toBe(false)
    expect(summarizeB8AudioEnvelopeQA([2,5,10,5],[2.1,5.1,10.2,5.2]).contentParity).toBe(true)
    expect(summarizeB8AudioEnvelopeQA([1,9,1,9],[9,1,9,1]).contentParity).toBe(false)
  })
  it('preserves running/done checkpoints on repeated queue generation without erasing work',()=>{
    const first=shardB8Jobs(candidates,{hashes:[hash],rendererRevision:'worker-v1'},8)
    const running={...first[0]!,attempts:1,runStatus:'running' as const}
    const done={...first[1]!,attempts:1,runStatus:'done' as const}
    const rendered={...first[2]!,attempts:1,runStatus:'rendered' as const,
      renderEvidence:'render-evidence/f03_bold.json'}
    const reconciled=reconcileB8Queue(first,[running,done,rendered])
    expect(reconciled.find(j=>j.id===running.id)?.runStatus).toBe('running')
    expect(reconciled.find(j=>j.id===done.id)?.runStatus).toBe('done')
    expect(reconciled.find(j=>j.id===rendered.id)).toMatchObject({
      runStatus:'rendered',renderEvidence:'render-evidence/f03_bold.json',
    })
    expect(reconciled.filter(j=>j.runStatus==='queued')).toHaveLength(1997)
    expect(reconcileB8Queue(first,reconciled)).toEqual(reconciled)
    const changed=shardB8Jobs(candidates,{hashes:[hash],rendererRevision:'worker-v2'},8)
    expect(()=>reconcileB8Queue(changed,reconciled)).toThrow(/active Batch 8 worker lease/)
    const reset=reconcileB8Queue(changed,reconciled.filter(j=>j.id!==running.id))
    expect(reset.every(j=>j.runStatus==='queued')).toBe(true)
    expect(()=>reconcileB8Queue(first,[done,done])).toThrow(/Duplicate/)
  })
  it('invalidates cache keys on fixture or renderer revisions; limits sharding',()=>{
    const fixture={hashes:[hash],rendererRevision:'worker-v1'}
    const a=shardB8Jobs(candidates,fixture,16)
    const b=shardB8Jobs(candidates,fixture,16)
    expect(a).toEqual(b)
    expect(a).toHaveLength(2000)
    expect(new Set(a.map(j=>j.id)).size).toBe(2000)
    expect(a.every(j=>j.shard>=0&&j.shard<16&&j.maxAttempts===3)).toBe(true)
    const c=shardB8Jobs(candidates,{...fixture,rendererRevision:'worker-v2'},16)
    expect(a[0]?.cacheKey).not.toBe(c.find(x=>x.id===a[0]?.id)?.cacheKey)
    expect(()=>shardB8Jobs(candidates,fixture,0)).toThrow()
    expect(()=>shardB8Jobs(candidates,{hashes:[],rendererRevision:'worker-v1'})).toThrow()
  })
})
