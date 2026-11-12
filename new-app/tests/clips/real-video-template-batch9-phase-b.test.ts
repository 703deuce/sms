import { describe,expect,it } from 'vitest'
import { FACTORY_TREATMENTS } from '@/lib/clips/real-video-templates/b8-authoring-catalog'
import { BATCH9A_ANCHOR_RELEASES } from '@/lib/clips/real-video-templates/batch9a-anchors'
import { generateB8Candidates } from '@/lib/clips/real-video-templates/b8-factory'
import { lintB8Legibility } from '@/lib/clips/real-video-templates/b8-legibility'
import { compileTemplateWithMusic } from '@/lib/clips/real-video-templates/music-sequence'
import { defaultEdits } from '@/lib/clips/edits'
import { templateFrameToMs,type TemplateAsset } from '@/lib/clips/real-video-templates/sequence-contract'
import { BATCH9_PHASE_B_CERTIFIED_RELEASES } from '@/lib/clips/real-video-templates/batch9-phase-b-certified'
import { FIRST_PARTY_VIDEO_TEMPLATES } from '@/lib/clips/real-video-templates/releases'
import {
  BATCH9_PHASE_A_ANCHORS,BATCH9_PHASE_B_VARIANT_TARGET,
  batch9PhaseAAnchorCandidates,batch9PhaseAAnchorGate,batch9PhaseBExpansionCandidates,batch9PhaseBIndependentReviewPlan,
  batch9PhaseBReleaseGate,
  batch9PhaseBReviewedReleases,batch9PhaseBStatus,batch9PhaseBWorkerIds,
  eligibleBatch9PhaseBVariants,
} from '@/lib/clips/real-video-templates/batch9-phase-b'

describe('Batch 9 Phase B style-pack expansion gate',()=>{
  it('keeps the production Phase B promotion boundary empty until certification',()=>{
    expect(BATCH9_PHASE_B_CERTIFIED_RELEASES).toEqual([])
    const phaseA=FIRST_PARTY_VIDEO_TEMPLATES.filter(row=>
      BATCH9_PHASE_A_ANCHORS.includes(row.id))
    expect(phaseA).toHaveLength(10)
    expect(phaseA.every(row=>row.certificationStatus==='preview')).toBe(true)
    expect(FIRST_PARTY_VIDEO_TEMPLATES.filter(row=>
      /^f(?:0[1-9]|10)_/.test(row.id)&&!BATCH9_PHASE_A_ANCHORS.includes(row.id))).toEqual([])
  })
  it('binds Phase A certification to the current live Batch 9A definitions',()=>{
    const live=batch9PhaseAAnchorCandidates()
    expect(live).toHaveLength(10)
    expect(live.map(row=>row.id)).toEqual(BATCH9A_ANCHOR_RELEASES.map(row=>row.id))
    expect(live.map(row=>row.family.revision)).toEqual(BATCH9A_ANCHOR_RELEASES.map(row=>row.family.revision))
    const old=new Map(generateB8Candidates().map(row=>[row.id,row]))
    expect(live.every(row=>row.definitionHash!==old.get(row.id)?.definitionHash)).toBe(true)
  })
  it('defines ten existing bold anchors and exactly 390 non-anchor variants',()=>{
    expect(BATCH9_PHASE_A_ANCHORS).toEqual(
      Array.from({length:10},(_,i)=>'f'+String(i+1).padStart(2,'0')+'_bold'))
    expect(FACTORY_TREATMENTS).toHaveLength(40)
    const rows=batch9PhaseBExpansionCandidates()
    expect(rows).toHaveLength(BATCH9_PHASE_B_VARIANT_TARGET)
    expect(rows.every(row=>Number(row.familyId.slice(1))<=10&&row.treatmentId!=='bold')).toBe(true)
    expect(new Set(rows.map(row=>row.id)).size).toBe(390)
    const anchors=new Map(BATCH9A_ANCHOR_RELEASES.map(row=>[row.family.familyId,row]))
    expect(rows.every(row=>row.family.revision===(anchors.get(row.familyId)?.family.revision??0)+1)).toBe(true)
    expect(rows.every(row=>row.family.texts[0]?.defaultText===anchors.get(row.familyId)?.family.texts[0]?.defaultText)).toBe(true)
    expect(rows.every(row=>row.family.slots.map(slot=>slot.durationFrames).join(',')===
      anchors.get(row.familyId)?.family.slots.map(slot=>slot.durationFrames).join(','))).toBe(true)
    expect(batch9PhaseBWorkerIds()).toEqual(rows.map(row=>row.id))
  })
  it('compiles all 390 variants as editable mixed-media edits with separate music',()=>{
    const hash='b'.repeat(64)
    const license={id:'phase_b_fixture',provenance:'first-party' as const,reference:'phase_b_fixture_v1'}
    const rights={assetId:'phase_b_music',origin:'first-party-test',author:'Test',
      license:'first-party',revision:'1',sha256:hash,commercialUse:true,
      exportAllowed:true,redistributionAllowed:false,
      verifiedDurationFrames:1800,verifiedAt:'2026-11-11'}
    const schedule={v:1 as const,mode:'beat-time' as const,musicAssetId:'phase_b_music',
      sha256:hash,bpm:150,confidence:'high' as const,offsetFrames:0,durationFrames:1800,
      beats:Array.from({length:600},(_,i)=>i*3),phrases:[],protectedAnchors:[]}
    const music:TemplateAsset={id:'phase_b_music',kind:'audio',durationFrames:1800,license}
    for(const candidate of batch9PhaseBExpansionCandidates()){
      expect(lintB8Legibility(candidate).filter(f=>f.severity==='block'),candidate.id).toEqual([])
      const media:Record<string,TemplateAsset>={}
      const family={...candidate.family,slots:candidate.family.slots.map((slot,index)=>{
        const video=index%3===1
        media[slot.id]=video
          ? {id:'video_'+index,kind:'video',durationFrames:1800,license}
          : {id:'image_'+index,kind:'image',license}
        return video?{...slot,sourceInFrame:slot.handles?.headFrames??0}:slot
      })}
      const durationMs=templateFrameToMs(family.totalFrames)
      const base=defaultEdits({clipStartMs:0,clipEndMs:durationMs})
      const result=compileTemplateWithMusic(family,candidate.design,{
        instanceId:'phase_b_'+candidate.id,media,music,
        templateMusic:{v:1,rights,schedule,choice:'keep-timing'},
      },{durationFrames:family.totalFrames,edits:{
        ...base,trim:{in:0,out:durationMs},
        layout:{...base.layout,mode:'full_frame'},aspectRatio:'9:16',
        captions:{...base.captions,enabled:false},
      }})
      expect(result.edits.sourceSegments,candidate.id).toHaveLength(family.slots.length)
      expect(result.edits.transitions,candidate.id).toHaveLength(family.slots.length-1)
      expect(result.edits.videoSplits,candidate.id).toHaveLength(family.slots.length-1)
      expect(result.edits.textItems?.length,candidate.id)
        .toBeGreaterThanOrEqual(family.texts.length+(family.graphics?.length??0))
      expect(result.edits.keyframes?.some(k=>k.target==='video'),candidate.id).toBe(true)
      expect(result.edits.audio?.music,candidate.id).toMatchObject({
        uploadId:'phase_b_music',loop:false,endMs:durationMs,
      })
      expect(result.edits.sources?.some(source=>source.refId.startsWith('video_')),candidate.id).toBe(true)
      expect(result.edits.sources?.some(source=>source.refId.startsWith('image_')),candidate.id).toBe(true)
    }
  })
  it('preselects exactly 39 independent reviews covering every non-bold treatment',()=>{
    const plan=batch9PhaseBIndependentReviewPlan()
    expect(plan).toHaveLength(39)
    expect(new Set(plan).size).toBe(39)
    const byId=new Map(batch9PhaseBExpansionCandidates().map(row=>[row.id,row]))
    expect(new Set(plan.map(id=>byId.get(id)?.treatmentId)).size).toBe(39)
    expect(new Set(plan.map(id=>byId.get(id)?.familyId)).size).toBe(10)
  })
  it('fails closed before all ten anchors carry real reviewed evidence',()=>{
    expect(batch9PhaseAAnchorGate([]).ready).toBe(false)
    const status=batch9PhaseBStatus([])
    expect(status.phaseAReady).toBe(false)
    expect(status.eligible).toBe(0)
    expect(eligibleBatch9PhaseBVariants([])).toEqual([])
    const releaseGate=batch9PhaseBReleaseGate([])
    expect(releaseGate.ready).toBe(false)
    expect(releaseGate.minimumIndependent).toBe(39)
    expect(batch9PhaseBReviewedReleases([])).toEqual([])
    expect(Object.keys(status.blockers)).toHaveLength(390)
    expect(status.blockers['f01_editorial']).toContain('first_ten_anchor_gate')
  })
})
