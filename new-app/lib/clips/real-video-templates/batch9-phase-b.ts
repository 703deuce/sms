import { createHash } from 'node:crypto'
import { FACTORY_FAMILY_SEEDS,FACTORY_TREATMENTS } from './b8-authoring-catalog'
import { BATCH9A_ANCHOR_RELEASES } from './batch9a-anchors'
import type { VideoTemplateRelease } from './gallery'
import {
  auditB8Evidence,generateB8Candidates,scoreB8Review,
  type B8Candidate,type B8Evidence,
} from './b8-factory'

export const BATCH9_PHASE_A_ANCHORS=BATCH9A_ANCHOR_RELEASES.map(release=>release.id) as readonly string[]
export const BATCH9_PHASE_B_VARIANT_TARGET=390 as const
const phaseHash=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex')

export function batch9PhaseAAnchorCandidates():readonly B8Candidate[]{
  if(BATCH9A_ANCHOR_RELEASES.length!==10)
    throw new Error('Batch 9 Phase A must contain exactly ten live anchors')
  return BATCH9A_ANCHOR_RELEASES.map(release=>({
    id:release.id,
    familyId:release.family.familyId,
    treatmentId:'bold',
    status:'draft' as const,
    authoringOrigin:'canonical' as const,
    authoredDimensions:[...release.authoredDimensions],
    family:release.family,
    design:release.design,
    fingerprint:phaseHash([release.family.slots,release.family.texts,release.family.graphics]),
    definitionHash:phaseHash(['batch9a-live-anchor-v1',release.family,release.design]),
  }))
}

export type Batch9PhaseAStatus={
  ready:boolean
  blockers:Record<string,string[]>
}
export function batch9PhaseAAnchorGate(evidence:readonly B8Evidence[]):Batch9PhaseAStatus{
  const byId=new Map(evidence.map(row=>[row.id,row]))
  const candidates=new Map(batch9PhaseAAnchorCandidates().map(candidate=>[candidate.id,candidate]))
  const blockers:Record<string,string[]>={}
  for(const id of BATCH9_PHASE_A_ANCHORS){
    const candidate=candidates.get(id)
    const row=byId.get(id)
    const issues=candidate?auditB8Evidence(candidate,row):['missing_anchor_candidate']
    if(row){
      const score=scoreB8Review(row)
      if(score.score<9||!score.minimum)issues.push('anchor_below_nine')
      if(!row.independentReviewer?.trim()||
         row.independentReviewer.trim()===row.reviewer?.trim())
        issues.push('anchor_needs_independent_review')
    }
    if(issues.length)blockers[id]=[...new Set(issues)]
  }
  return {ready:Object.keys(blockers).length===0,blockers}
}

export function batch9PhaseBExpansionCandidates():readonly B8Candidate[]{
  const firstTen=new Set(FACTORY_FAMILY_SEEDS.slice(0,10).map(row=>row.id))
  const variants=generateB8Candidates().filter(candidate=>
    firstTen.has(candidate.familyId)&&candidate.treatmentId!=='bold')
  if(FACTORY_TREATMENTS.length!==40||variants.length!==BATCH9_PHASE_B_VARIANT_TARGET)
    throw new Error('Batch 9 Phase B must contain exactly 390 non-anchor variants')
  return variants
}

export type Batch9PhaseBStatus={
  phaseAReady:boolean
  target:number
  reviewed:number
  eligible:number
  blockers:Record<string,string[]>
}
export function batch9PhaseBStatus(evidence:readonly B8Evidence[]):Batch9PhaseBStatus{
  const phaseA=batch9PhaseAAnchorGate(evidence)
  const byId=new Map(evidence.map(row=>[row.id,row]))
  const blockers:Record<string,string[]>={}
  let reviewed=0,eligible=0
  for(const candidate of batch9PhaseBExpansionCandidates()){
    const row=byId.get(candidate.id)
    if(row?.reviewer?.trim())reviewed++
    const issues:string[]=[]
    if(!phaseA.ready)issues.push('first_ten_anchor_gate')
    issues.push(...auditB8Evidence(candidate,row))
    if(!issues.length)eligible++
    else blockers[candidate.id]=[...new Set(issues)]
  }
  return {phaseAReady:phaseA.ready,target:BATCH9_PHASE_B_VARIANT_TARGET,
    reviewed,eligible,blockers}
}

/**
 * No public gallery multiplication: only exact variants that have their own real
 * render evidence and pass the Phase A anchor gate are returned.
 */
export function eligibleBatch9PhaseBVariants(evidence:readonly B8Evidence[]):readonly B8Candidate[]{
  const status=batch9PhaseBStatus(evidence)
  if(!status.phaseAReady)return []
  const byId=new Map(evidence.map(row=>[row.id,row]))
  return batch9PhaseBExpansionCandidates().filter(candidate=>
    auditB8Evidence(candidate,byId.get(candidate.id)).length===0)
}

export type Batch9PhaseBReleaseGate={
  ready:boolean
  independentCount:number
  minimumIndependent:number
  missingTreatmentAudits:string[]
  flaggedWithoutIndependent:string[]
}
export function batch9PhaseBReleaseGate(evidence:readonly B8Evidence[]):Batch9PhaseBReleaseGate{
  const phaseA=batch9PhaseAAnchorGate(evidence)
  const byId=new Map(evidence.map(row=>[row.id,row]))
  const eligible=eligibleBatch9PhaseBVariants(evidence)
  const independent=eligible.filter(candidate=>Boolean(byId.get(candidate.id)?.independentReviewer?.trim()))
  const minimumIndependent=Math.ceil(BATCH9_PHASE_B_VARIANT_TARGET*.1)
  const covered=new Set(independent.map(candidate=>candidate.treatmentId))
  const missingTreatmentAudits=FACTORY_TREATMENTS
    .filter(row=>row.id!=='bold'&&!covered.has(row.id)).map(row=>row.id)
  const flaggedWithoutIndependent=eligible.filter(candidate=>{
    const row=byId.get(candidate.id)
    return Boolean(row?.flagged&&!row.independentReviewer?.trim())
  }).map(candidate=>candidate.id)
  return {
    ready:phaseA.ready&&eligible.length===BATCH9_PHASE_B_VARIANT_TARGET&&
      independent.length>=minimumIndependent&&missingTreatmentAudits.length===0&&
      flaggedWithoutIndependent.length===0,
    independentCount:independent.length,minimumIndependent,
    missingTreatmentAudits,flaggedWithoutIndependent,
  }
}

export function batch9PhaseBReviewedReleases(
  evidence:readonly B8Evidence[],
):readonly VideoTemplateRelease[]{
  const gate=batch9PhaseBReleaseGate(evidence)
  if(!gate.ready)return []
  const byId=new Map(evidence.map(row=>[row.id,row]))
  return eligibleBatch9PhaseBVariants(evidence).map(candidate=>{
    const row=byId.get(candidate.id)!
    const seed=FACTORY_FAMILY_SEEDS.find(item=>item.id===candidate.familyId)!
    return {
      id:candidate.id,title:candidate.family.title+' · '+candidate.treatmentId,
      category:seed.category,description:'Reviewed first-party style expansion',
      demoPath:row.outputs.renderMp4,demoPosterPath:row.outputs.poster,
      family:candidate.family,design:candidate.design,
      rights:'Pinned license evidence: '+row.fixtures.licenseHashes.join(','),
      requiredCapabilities:['clip_edits_v2','source_transforms','text_layers','music_track'],
      authoredDimensions:[...candidate.authoredDimensions],
      reviewed:true,previewRenderVerified:true,certificationStatus:'certified',
      musicRequired:true,
    } satisfies VideoTemplateRelease
  })
}

export function batch9PhaseBWorkerIds():readonly string[]{
  const ids=batch9PhaseBExpansionCandidates().map(candidate=>candidate.id)
  if(ids.length!==BATCH9_PHASE_B_VARIANT_TARGET||new Set(ids).size!==ids.length)
    throw new Error('Batch 9 Phase B worker IDs must be 390 unique variants')
  return ids
}

export function batch9PhaseBIndependentReviewPlan():readonly string[]{
  const variants=batch9PhaseBExpansionCandidates()
  const byTreatment=new Map<string,B8Candidate[]>()
  for(const candidate of variants){
    const rows=byTreatment.get(candidate.treatmentId)??[]
    rows.push(candidate);byTreatment.set(candidate.treatmentId,rows)
  }
  const treatments=FACTORY_TREATMENTS.filter(row=>row.id!=='bold').map(row=>row.id)
  const plan=treatments.map((treatment,index)=>{
    const rows=byTreatment.get(treatment)??[]
    if(rows.length!==10)throw new Error('Phase B treatment must exist in all ten families: '+treatment)
    return rows[index%rows.length]!.id
  })
  if(plan.length!==39||new Set(plan).size!==39)
    throw new Error('Phase B independent review plan must contain 39 unique variants')
  return plan
}
