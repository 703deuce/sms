import { createHash } from 'node:crypto'
import { FACTORY_FAMILY_SEEDS,FACTORY_TREATMENTS,
  type FactoryTreatmentRecipe } from './b8-authoring-catalog'
import { BATCH9A_ANCHOR_RELEASES } from './batch9a-anchors'
import type { VideoTemplateRelease } from './gallery'
import { validateTemplateDesign,validateTemplateFamily } from './sequence-contract'
import { templateTextStylePreset } from './template-text-presets'
import {
  auditB8Evidence,scoreB8Review,
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

const phaseBHeadlineSize=(font:string,size:number)=>{
  const scale=font==='Press Start 2P'?0.62:
    font==='Monoton'||font==='Rubik Glitch'||font==='Rubik Dirt'?0.78:
    font==='Permanent Marker'||font==='Bangers'||font==='Bungee'?0.88:1
  return Math.max(72,Math.round(size*scale))
}
const phaseBTextFinishes=(recipe:FactoryTreatmentRecipe)=>{
  const script=/Caveat|Pacifico|Great Vibes|Kalam|Indie Flower|Lobster|Permanent Marker/.test(recipe.headingFont)
  const neon=/neon|retro_arcade|tech/.test(recipe.id)
  const soft=/editorial|cinema|luxury|noir|minimal|wedding|warm|journal|magazine/.test(recipe.id)
  const playful=/party|kids|scrapbook|pastel|rounded/.test(recipe.id)
  const headlineId=script?'hook_script':neon?'hook_neon':playful?'hook_label':soft?'hook_soft':'hook_punch'
  const closingId=playful?'line_pill':neon||/sport|news|bold/.test(recipe.id)?'line_accent':'line_minimal'
  const headline=templateTextStylePreset(headlineId),closing=templateTextStylePreset(closingId)
  if(!headline||!closing)throw new Error('Missing Phase B text finish preset')
  return {headline,closing}
}
function phaseBVariantCandidate(
  anchor:VideoTemplateRelease,recipe:FactoryTreatmentRecipe,
):B8Candidate{
  const last=anchor.family.slots.length-1
  // Compress extreme editorial placements toward center for large CapCut-scale
  // hooks while preserving a clearly visible left/right treatment difference.
  const textX=Math.round(50+(recipe.x-50)*0.55)
  const finishes=phaseBTextFinishes(recipe)
  const family=validateTemplateFamily({
    ...anchor.family,
    revision:anchor.family.revision+1,
    tags:[...anchor.family.tags.filter(tag=>tag!=='first_party_preview'),
      'batch9_phase_b',recipe.id],
    slots:anchor.family.slots.map((slot,index)=>({
      ...slot,
      transition:index===0?'cut':{
        type:index===last?'crossfade':recipe.transition,
        durationFrames:index===last?8:5,
      },
    })),
    texts:anchor.family.texts.map(text=>{
      const headline=text.id==='headline'
      return {
        ...text,
        x:textX,
        y:headline?Math.max(24,Math.min(68,recipe.y)):text.y,
        font:headline?recipe.headingFont:recipe.supportFont,
        size:headline?phaseBHeadlineSize(recipe.headingFont,text.size):text.size,
        color:headline?recipe.foreground:
          (finishes.closing.id==='line_accent'?recipe.accent:recipe.foreground),
        case:headline?finishes.headline.case:finishes.closing.case,
        stylePresetId:headline?finishes.headline.id:finishes.closing.id,
        finish:{...(headline?finishes.headline.finish:finishes.closing.finish)},
        anim:headline?{
          ...(text.anim??{}),
          in:{type:recipe.enter,unit:'block' as const,durMs:360},
        }:text.anim,
      }
    }),
    graphics:(anchor.family.graphics??[]).map((graphic,index)=>index?graphic:{
      ...graphic,type:recipe.graphic,x:recipe.gx,y:recipe.gy,
      w:['circle','star','heart','triangle'].includes(recipe.graphic)?44:124,
      h:['circle','star','heart','triangle'].includes(recipe.graphic)?44:16,
      color:recipe.accent,
    }),
  })
  const design=validateTemplateDesign({
    ...anchor.design,
    designId:anchor.family.familyId+'_'+recipe.id,
    revision:anchor.design.revision+1,
    stylePackId:'batch9b_'+recipe.id,
    familyRevision:family.revision,
  },family)
  return {
    id:design.designId,familyId:family.familyId,treatmentId:recipe.id,
    status:'draft',authoringOrigin:'canonical',
    authoredDimensions:['font-hierarchy','text-placement','animation-choreography',
      'graphic-composition','transition-treatment','source-motion'],
    family,design,
    fingerprint:phaseHash([recipe.id,family.texts,family.graphics,
      family.slots.map(slot=>[slot.transition,slot.motion,slot.fx])]),
    definitionHash:phaseHash(['batch9-phase-b-v2',family,design]),
  }
}
export function batch9PhaseBExpansionCandidates():readonly B8Candidate[]{
  const recipes=FACTORY_TREATMENTS.filter(recipe=>recipe.id!=='bold')
  const variants=BATCH9A_ANCHOR_RELEASES.flatMap(anchor=>
    recipes.map(recipe=>phaseBVariantCandidate(anchor,recipe)))
  if(FACTORY_TREATMENTS.length!==40||recipes.length!==39||
     variants.length!==BATCH9_PHASE_B_VARIANT_TARGET)
    throw new Error('Batch 9 Phase B must contain exactly 390 live-anchor variants')
  if(new Set(variants.map(row=>row.id)).size!==variants.length)
    throw new Error('Batch 9 Phase B variant IDs must be unique')
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
