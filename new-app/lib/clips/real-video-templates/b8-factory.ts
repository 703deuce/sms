/**
 * Batch 8 deterministic first-party candidate factory and fail-closed evidence gate.
 * This module does NOT publish candidates to releases.ts. Final approval is a
 * local, explicit manifest operation requiring real worker output and human QA.
 */
import { createHash } from 'node:crypto'
import { CLIP_FONT_MANIFEST, CLIP_FONT_MANIFEST_VERSION } from '@/lib/clips/font-manifest'
import { defaultEdits } from '@/lib/clips/edits'
import {
  compileTemplate, templateFrameToMs, validateTemplateDesign, validateTemplateFamily,
  type TemplateAsset, type TemplateCompileResult, type TemplateDesignV1,
  type TemplateFamilyV1, type TemplateSlot,
} from './sequence-contract'
import { FACTORY_FAMILY_SEEDS, FACTORY_TREATMENTS,
  type FactoryFamilySeed, type FactoryTreatmentRecipe } from './b8-authoring-catalog'
import type { VideoTemplateRelease } from './gallery'
import { lintB8Legibility } from './b8-legibility'
import { b8ReferenceForFamily } from './b8-reference-catalog'

export const B8_ENGINE_REVISION = 'b8-factory-v2' as const
export const B8_TARGET = { families: 50, treatmentsPerFamily: 40,
  coreTreatments: 25, authoredAlternates: 15, candidateTotal: 2000 } as const
const HASH = /^[a-f\d]{64}$/i
const safeID = /^[a-z0-9_]{2,80}$/
const fontSet = new Set(CLIP_FONT_MANIFEST.filter(row => row.browserGitBlobSha1 &&
  row.licenseFile && row.workerFile).map(row => row.id))
const sha = (input: unknown) => createHash('sha256').update(JSON.stringify(input)).digest('hex')
export type B8Candidate = {
  id: string
  familyId: string
  treatmentId: string
  status: 'draft'
  authoringOrigin: 'canonical'
  authoredDimensions: readonly string[]
  family: TemplateFamilyV1
  design: TemplateDesignV1
  fingerprint: string
  definitionHash: string
}
function ensureRecipes() {
  if (FACTORY_FAMILY_SEEDS.length !== B8_TARGET.families ||
      FACTORY_TREATMENTS.length !== B8_TARGET.treatmentsPerFamily ||
      FACTORY_TREATMENTS.filter(r=>r.kind === 'core').length !== B8_TARGET.coreTreatments ||
      FACTORY_TREATMENTS.filter(r=>r.kind === 'alternate').length !== B8_TARGET.authoredAlternates)
    throw new Error('Batch 8 incomplete family/curated style source')
  const ids = new Set<string>()
  for (const r of FACTORY_TREATMENTS) {
    if (!safeID.test(r.id) || ids.has(r.id)) throw new Error('Duplicate/unsafe treatment ' + r.id)
    ids.add(r.id)
    if (!fontSet.has(r.headingFont) || !fontSet.has(r.supportFont))
      throw new Error('Treatment references an unpinned font: ' + r.id)
    if (!(r.x >= 18 && r.x <= 82 && r.y >= 16 && r.y <= 75 &&
          r.gx >= 12 && r.gx <= 85 && r.gy >= 12 && r.gy <= 85))
      throw new Error('Treatment violates the canonical safe-zone margins: ' + r.id)
    if (!/^#[0-9a-fA-F]{6}$/.test(r.foreground) || !/^#[0-9a-fA-F]{6}$/.test(r.accent))
      throw new Error('Invalid treatment color')
    if (r.kind === 'alternate') {
      const parent = FACTORY_TREATMENTS.find(p=>p.id === r.parentId && p.kind === 'core')
      if (!parent) throw new Error('Alternate without a source recipe: ' + r.id)
      const dims = [
        r.headingFont !== parent.headingFont || r.supportFont !== parent.supportFont,
        r.x !== parent.x || r.y !== parent.y,
        r.enter !== parent.enter,
        r.graphic !== parent.graphic || r.gx !== parent.gx || r.gy !== parent.gy,
        r.transition !== parent.transition,
      ].filter(Boolean).length
      if (dims < 3) throw new Error('Alternate needs at least 3 visible authored differences: '+ r.id)
    }
  }
  const fingerprints = FACTORY_TREATMENTS.map(t=>sha([t.headingFont,t.supportFont,t.x,t.y,t.enter,
    t.graphic,t.gx,t.gy,t.transition,t.foreground,t.accent]))
  if (new Set(fingerprints).size !== fingerprints.length)
    throw new Error('Visually duplicate treatment recipe')
}
const ROLES: readonly TemplateSlot['role'][] = ['hero','support','detail','closing']
function authorFamily(seed: FactoryFamilySeed, recipe: FactoryTreatmentRecipe): TemplateFamilyV1 {
  let at = 0
  const slots: TemplateFamilyV1['slots'] = seed.frames.map((durationFrames,index) => {
    const slot: TemplateFamilyV1['slots'][number] = {
      id: 'slot_' + String(index + 1).padStart(2,'0'),
      ordinal: index + 1, role: seed.roles[index]!, media: 'either',
      startFrame: at, durationFrames, fit: 'cover', sourceAudio: 'mute',
      handles: { headFrames: 6, tailFrames: 6 },
      transition: index === 0 ? 'cut' : { type: recipe.transition, durationFrames: 6 },
      motion: { from: { x: 0, scale: 100 },
        to: { x: (index % 2 ? -4 : 4), scale: (seed.category === 'depth' ? 108 : 103) },
        ease: 'inOut' },
    }
    at += durationFrames
    return slot
  })
  const total = at
  const textTime = Math.min(total,150)
  const outroTime = Math.min(total,120)
  const titleX = recipe.x
  const titleY = recipe.y
  const subY = titleY > 59 ? titleY - 13 : titleY + 13
  return validateTemplateFamily({
    schemaVersion:1, familyId:seed.id, revision:1, title:seed.title,
    tags:[seed.category, 'first_party_candidate'], aspects:['9:16'], fps:30,
    totalFrames:total, slots,
    beatAnchors: slots.map(s=>s.startFrame),
    phraseAnchors: [{id:'opening',frame:0,textFieldId:'headline'},
      {id:'closing',frame:total-outroTime,textFieldId:'closing_line'}],
    texts: [
      { id:'headline', defaultText:'Your story', maxChars:70,
        startFrame:0, durationFrames:textTime, x:titleX,y:titleY,
        font:recipe.headingFont, size:recipe.headingFont === 'Press Start 2P' ? 48 :
          (titleX < 40 || titleX > 60 ? 60 : 74),
        color:recipe.foreground,
        anim:{in:{type:recipe.enter,unit:'block',durMs:360},
          out:{type:'fade',unit:'block',durMs:260}} },
      { id:'closing_line',defaultText:'Make it yours',maxChars:65,
        startFrame:total-outroTime,durationFrames:outroTime,
        x:titleX,y:subY,font:recipe.supportFont,size:44,color:recipe.foreground,
        anim:{in:{type:'fade',unit:'block',durMs:440},
          out:{type:'fade',unit:'block',durMs:260}} },
    ],
    graphics:[{ id:'accent_shape',type:recipe.graphic,startFrame:0,
      durationFrames:Math.min(total,120),x:recipe.gx,y:recipe.gy,w:110,h:40,
      color:recipe.accent,
      anim:{in:{type:'slide_up',unit:'block',durMs:420},loop:{type:'pulse',periodMs:1800}} }],
  })
}
export function generateB8Candidates(): B8Candidate[] {
  ensureRecipes()
  const out: B8Candidate[] = []
  const ids = new Set<string>()
  for (const seed of FACTORY_FAMILY_SEEDS) {
    if (!safeID.test(seed.id) || seed.roles.length !== seed.frames.length ||
        seed.roles.some(role=>!ROLES.includes(role))) throw new Error('Invalid source family '+seed.id)
    for (const r of FACTORY_TREATMENTS) {
      const family = authorFamily(seed,r)
      const design = validateTemplateDesign({
        schemaVersion:1, designId:seed.id+'_'+r.id,revision:1,
        stylePackId:r.id,familyId:seed.id,familyRevision:1,
        musicPolicy:'licensed-only',
      },family)
      const id = design.designId
      if (ids.has(id)) throw new Error('Non-unique pinned design ID '+id)
      ids.add(id)
      const visual = [r.headingFont,r.supportFont,r.x,r.y,r.enter,r.graphic,
        r.gx,r.gy,r.transition,seed.roles,seed.frames]
      const fingerprint = sha(visual)
      out.push({id,familyId:seed.id,treatmentId:r.id,status:'draft',
        authoringOrigin:'canonical',
        authoredDimensions:['font-hierarchy','text-placement','animation-choreography',
          'graphic-composition','transition-treatment'],
        family,design,fingerprint,definitionHash:sha([B8_ENGINE_REVISION,family,design])})
    }
  }
  if (out.length !== B8_TARGET.candidateTotal) throw new Error('Batch 8 candidate matrix is incomplete')
  return out
}
export type B8StructureProof = {
  id:string; durationFrames:number; slotItems:number; transitions:number;
  textItems:number; videoCuts:number; musicPresent:boolean; compilationHash:string
}
export type B8EditableAuditOptions = {
  requireMusic?: boolean
  expectedMusicAssetId?: string
}
/**
 * Exact structural audit for the native ClipEditsV2 emitted by the shared
 * template compiler. This is intentionally stricter than "it compiled":
 * every authored cut, cross-source transition, animated layer and output-clock
 * segment must survive as independently editable data. It never inspects MP4
 * pixels; render QA remains a separate gate.
 */
export function auditB8EditableOutput(
  c:B8Candidate,
  compiled:TemplateCompileResult,
  options:B8EditableAuditOptions={},
):string[] {
  const issues:string[]=[]
  const edits=compiled.edits
  const expectedCuts=c.family.slots.slice(1).map(slot=>templateFrameToMs(slot.startFrame))
  const expectedTransitions=c.family.slots.slice(1).filter(slot=>slot.transition!=='cut')
  const segments=edits.sourceSegments??[]
  if(segments.length!==c.family.slots.length)issues.push('editable_source_segment_count')
  if(compiled.sequence.items.length!==c.family.slots.length)issues.push('sequence_item_count')
  for(const [index,slot] of c.family.slots.entries()){
    const segment=segments[index],item=compiled.sequence.items[index]
    const startMs=templateFrameToMs(slot.startFrame)
    const endMs=templateFrameToMs(slot.startFrame+slot.durationFrames)
    if(!segment||segment.startMs!==startMs||segment.endMs!==endMs)
      issues.push('slot_clock_mismatch:'+slot.id)
    if(!item||item.slotId!==slot.id||item.outputStartFrame!==slot.startFrame||
       item.outputEndFrame!==slot.startFrame+slot.durationFrames)
      issues.push('sequence_clock_mismatch:'+slot.id)
  }
  if(JSON.stringify(edits.videoSplits??[])!==JSON.stringify(expectedCuts))
    issues.push('editable_cut_boundaries')
  const transitions=edits.transitions??[]
  if(transitions.length!==expectedTransitions.length)issues.push('editable_transition_count')
  for(const slot of expectedTransitions){
    const transition=slot.transition
    if(transition==='cut')continue
    const srcMs=templateFrameToMs(slot.startFrame)
    const found=transitions.find(row=>row.srcMs===srcMs)
    if(!found||found.type!==transition.type||
       found.durMs!==templateFrameToMs(transition.durationFrames))
      issues.push('editable_transition_mismatch:'+slot.id)
  }
  const authoredLayers=c.family.texts.length+(c.family.graphics?.length??0)
  const layers=edits.textItems??[]
  if(layers.length!==authoredLayers)issues.push('editable_layer_count')
  if(layers.filter(layer=>Boolean(layer.anim)).length!==authoredLayers)
    issues.push('animated_layer_loss')
  if(layers.filter(layer=>layer.kind==='shape').length!==(c.family.graphics?.length??0))
    issues.push('editable_graphic_loss')
  const textLayers=layers.filter(layer=>layer.kind!=='shape')
  for(const text of c.family.texts){
    const startMs=templateFrameToMs(text.startFrame),endMs=templateFrameToMs(text.startFrame+text.durationFrames)
    if(!textLayers.some(layer=>layer.startMs===startMs&&layer.endMs===endMs&&
       layer.style?.font===text.font&&layer.anim))
      issues.push('editable_text_mismatch:'+text.id)
  }
  if(c.family.slots.some(slot=>slot.motion)&&
     !(edits.keyframes??[]).some(track=>track.target==='video'&&track.points.length>=2))
    issues.push('source_motion_keyframes_missing')
  if((edits.inserts?.length??0)!==0)issues.push('flattened_insert_present')
  if((edits.cutRanges?.length??0)!==0)issues.push('destructive_cut_ranges_present')
  if(edits.templateProvenance?.familyId!==c.family.familyId||
     edits.templateProvenance?.designId!==c.design.designId)
    issues.push('template_provenance_mismatch')
  if(options.requireMusic){
    const music=edits.audio?.music
    if(!music)issues.push('separate_music_track_missing')
    else if(options.expectedMusicAssetId&&
      music.uploadId!==options.expectedMusicAssetId&&music.generationId!==options.expectedMusicAssetId)
      issues.push('music_asset_identity_mismatch')
  }
  return [...new Set(issues)]
}
/** In-memory compiler proof only; NEVER a rendered MP4 or certified release. */
export function proveB8Structure(c:B8Candidate):B8StructureProof {
  const durationMs = templateFrameToMs(c.family.totalFrames)
  const base = defaultEdits({clipStartMs:0,clipEndMs:durationMs})
  const media:Record<string,TemplateAsset> = {}
  for (const slot of c.family.slots) media[slot.id] = {
    id:'fixture_'+slot.id,kind:'image',
    license:{id:'fixture_only',provenance:'user-owned',reference:'structural_compiler_test'},
  }
  const compiled = compileTemplate(c.family,c.design,{instanceId:'b8_structure_'+c.familyId,
    media},{durationFrames:c.family.totalFrames,edits:base})
  const count = compiled.edits.sourceSegments?.length ?? 0
  const transitions = compiled.edits.transitions?.length ?? 0
  const layers = compiled.edits.textItems?.length ?? 0
  const editableIssues=auditB8EditableOutput(c,compiled)
  if(editableIssues.length)
    throw new Error('Compiler dropped authored editable structure for '+c.id+': '+editableIssues.join(','))
  return {id:c.id,durationFrames:c.family.totalFrames,slotItems:count,transitions,
    videoCuts:compiled.edits.videoSplits?.length ?? 0,
    textItems:layers,musicPresent:Boolean(compiled.edits.audio?.music),
    compilationHash:sha([compiled.edits.sourceSegments,compiled.edits.transitions,
      compiled.edits.textItems,compiled.edits.keyframes])}
}
export type B8ReviewScores = {pacing:number;beatSemantic:number;transition:number;
  typography:number;motion:number;color:number}
export type B8Evidence = {
  id:string
  /** Exact authored candidate definition that produced the machine render. */
  definitionHash?:string
  reference:{url:string;accessDate:string;mediaKind:'short_video'|'photo_video'}
  fixtures:{images:readonly string[];videos:readonly string[];licenseHashes:readonly string[]}
  outputs:{previewMp4:string;renderMp4:string;poster:string;
    previewSha256:string;renderSha256:string;posterSha256:string}
  renderTiming:{
    v:1;totalFrames:number;boundaries:readonly number[];musicScheduleSha256:string
  }
  checks:{
    fullFrameStructure:boolean;durationMatch:boolean;audioParity:boolean;
    beatAligned:boolean;firstLastNotBlack:boolean;boundariesNotBlack:boolean;
    sampledFrameParity:boolean;glyphsPresent:boolean;contrastReadable:boolean;
    safeZones:boolean;layerRetention:boolean;rightsCleared:boolean;
    noExcessFlashing:boolean;actualWorkerRender:boolean
  }
  reviewer:string;reviewDate:string;scores:B8ReviewScores
  independentReviewer?:string
  flagged?:boolean
}
const weights:Readonly<Record<keyof B8ReviewScores,number>> = {
  pacing:2,beatSemantic:2,transition:1.5,typography:2,motion:1.5,color:1,
}
export function scoreB8Review(e:B8Evidence) {
  const entries=Object.entries(weights) as [keyof B8ReviewScores,number][]
  const score=entries.reduce((sum,[k,w])=>sum+e.scores[k]/5*w,0)
  const minimum=entries.every(([k])=>Number.isFinite(e.scores[k]) &&
    e.scores[k]>=4 && e.scores[k]<=5)
  return {score:Math.round(score*1000)/1000,minimum}
}
const credibleLocal = (s:string,ext:RegExp) =>
  typeof s==='string' && /^\/(?!\/)[\w./-]+$/.test(s) && !s.includes('..') && ext.test(s)
export function auditB8Evidence(c:B8Candidate,e:B8Evidence|undefined):string[] {
  if(!e)return ['missing_evidence']
  const issues:string[]=[]
  if(e.id!==c.id)issues.push('design_identity_mismatch')
  if(e.definitionHash!==c.definitionHash)issues.push('stale_or_missing_definition_hash')
  if(lintB8Legibility(c).some(finding=>finding.severity==='block'))
    issues.push('unresolved_static_legibility')
  const pinnedReference=b8ReferenceForFamily(c.familyId)
  if(!e.reference || e.reference.url!==pinnedReference.url ||
     e.reference.accessDate!==pinnedReference.accessDate)
    issues.push('unreviewed_same_type_reference')
  if(!e.fixtures || !e.fixtures.images?.length || !e.fixtures.videos?.length ||
    !e.fixtures.licenseHashes?.length ||
    e.fixtures.licenseHashes.some(hash=>!HASH.test(hash)))issues.push('missing_licensed_real_media')
  const timing=e.renderTiming
  if(!timing||timing.v!==1||!Number.isInteger(timing.totalFrames)||timing.totalFrames<1||
     !HASH.test(timing.musicScheduleSha256)||!Array.isArray(timing.boundaries)||
     timing.boundaries.length!==c.family.slots.length+1||timing.boundaries[0]!==0||
     timing.boundaries[timing.boundaries.length-1]!==timing.totalFrames||
     timing.boundaries.some((frame,i)=>!Number.isInteger(frame)||frame<0||
       (i>0&&(frame<=timing.boundaries[i-1]!||frame-timing.boundaries[i-1]!<9))))
    issues.push('missing_pinned_render_timing')
  const out=e.outputs
  if(!out || !credibleLocal(out.previewMp4,/\.mp4$/i) ||
    !credibleLocal(out.renderMp4,/\.mp4$/i) ||
    !credibleLocal(out.poster,/\.(png|webp|jpg)$/i) ||
    !HASH.test(out.previewSha256)||!HASH.test(out.renderSha256)||!HASH.test(out.posterSha256))
    issues.push('missing_render_preview_poster_hash')
  if(!e.checks || Object.values(e.checks).some(x=>x!==true) ||
     Object.keys({fullFrameStructure:0,durationMatch:0,audioParity:0,beatAligned:0,
       firstLastNotBlack:0,boundariesNotBlack:0,sampledFrameParity:0,
       glyphsPresent:0,contrastReadable:0,safeZones:0,layerRetention:0,
       rightsCleared:0,noExcessFlashing:0,actualWorkerRender:0})
       .some(k=>e.checks[k as keyof B8Evidence['checks']]!==true))
    issues.push('unverified_render_quality_or_rights')
  if(!e.reviewer?.trim()||!/^20\d\d-\d\d-\d\d$/.test(e.reviewDate))
    issues.push('missing_editor_review')
  if(!e.scores || (Object.keys(weights) as (keyof B8ReviewScores)[])
    .some(k=>typeof e.scores[k]!=='number'))issues.push('missing_scores')
  else{
    const s=scoreB8Review(e)
    if(s.score<9 || !s.minimum)issues.push('qa_score_below_nine_or_dimension_below_four')
  }
  if(e.independentReviewer?.trim() && e.independentReviewer.trim()===e.reviewer?.trim())
    issues.push('independent_reviewer_must_differ')
  if(e.flagged && !e.independentReviewer?.trim())issues.push('flagged_variant_needs_independent_review')
  return issues
}
export type B8QualityReport = {defined:number;generated:number;previewed:number;
  autoRenderPass:number;editorReviewed:number;released:number;community:number;
  familyCount:number;designCount:number;blockers:Record<string,string[]>;releasedIds:string[]}
export function reportB8Quality(candidates:readonly B8Candidate[],
  evidence:readonly B8Evidence[]):B8QualityReport {
  const map=new Map(evidence.map(e=>[e.id,e]))
  if(map.size!==evidence.length)throw new Error('Duplicate evidence IDs')
  const blockers:Record<string,string[]>={}
  const valid=new Set<string>()
  let previewed=0,autoRenderPass=0,editorReviewed=0
  for(const c of candidates){
    const e=map.get(c.id)
    if(e?.outputs?.previewMp4)previewed++
    if(e?.checks && Object.values(e.checks).every(Boolean))autoRenderPass++
    if(e?.reviewer && e?.scores)editorReviewed++
    const issues=auditB8Evidence(c,e)
    if(issues.length)blockers[c.id]=issues
    else valid.add(c.id)
  }
  const anchors=FACTORY_FAMILY_SEEDS.slice(0,10).map(f=>f.id+'_bold')
  const anchorsReady=anchors.every(id=>valid.has(id) &&
    Boolean(map.get(id)?.independentReviewer?.trim()) &&
    map.get(id)?.independentReviewer?.trim()!==map.get(id)?.reviewer?.trim())
  const independent=[...valid].filter(id=>map.get(id)?.independentReviewer?.trim()).length
  const independentReady=independent>=Math.ceil(valid.size*.1)
  const stylesReady=FACTORY_TREATMENTS.every(r=>[...valid].some(id=>
    id.endsWith('_'+r.id)&&map.get(id)?.independentReviewer?.trim()))
  const releasedIds=[...valid].filter(id=>
    anchorsReady && independentReady && stylesReady &&
    valid.has(id.slice(0,3)+'_bold')).sort()
  for(const id of valid){
    if(!releasedIds.includes(id)){
      blockers[id]=!anchorsReady?['first_ten_anchor_gate']:
        !independentReady?['ten_percent_independent_gate']:
        !stylesReady?['every_treatment_independent_gate']:['family_anchor_gate']
    }
  }
  return {defined:candidates.length,generated:candidates.length,previewed,autoRenderPass,
    editorReviewed,released:releasedIds.length,community:0,
    familyCount:new Set(candidates.map(c=>c.familyId)).size,
    designCount:new Set(candidates.map(c=>c.id)).size,blockers,releasedIds}
}
export function locallyApprovedB8Releases(candidates:readonly B8Candidate[],
  evidence:readonly B8Evidence[]):VideoTemplateRelease[]{
  const report=reportB8Quality(candidates,evidence)
  const byID=new Map(evidence.map(e=>[e.id,e]))
  return candidates.filter(c=>report.releasedIds.includes(c.id)).map((c):VideoTemplateRelease=>{
    const e=byID.get(c.id)!
    return {id:c.id,title:c.family.title+' · '+c.treatmentId,
      category:FACTORY_FAMILY_SEEDS.find(f=>f.id===c.familyId)!.category,
      description:'Editor-reviewed first-party video design',demoPath:e.outputs.renderMp4,
      demoPosterPath:e.outputs.poster,family:c.family,design:c.design,
      rights:'Pinned license evidence: '+e.fixtures.licenseHashes.join(','),
      requiredCapabilities:['clip_edits_v2','source_transforms','text_layers','music_track',
        'cross_source_transitions','frame_accurate_slots'],
      authoredDimensions:[...c.authoredDimensions],
      reviewed:true,previewRenderVerified:true}
  })
}
export type B8ShardJob = {id:string;shard:number;cacheKey:string;
  definitionHash:string;status:'queued';maxAttempts:3}
export function shardB8Jobs(candidates:readonly B8Candidate[],
  fixtures:{hashes:readonly string[];rendererRevision:string},
  shardCount=16):B8ShardJob[]{
  if(!Number.isInteger(shardCount)||shardCount<1||shardCount>256 ||
     !fixtures.hashes.length || fixtures.hashes.some(h=>!HASH.test(h)) ||
     !/^[A-Za-z0-9_.-]{2,80}$/.test(fixtures.rendererRevision))
    throw new Error('Pinned fixture/renderer hashes and bounded shard count required')
  return candidates.map(c=>{
    const cacheKey=sha([c.definitionHash,CLIP_FONT_MANIFEST_VERSION,
      fixtures.hashes,fixtures.rendererRevision,B8_ENGINE_REVISION])
    return {id:c.id,shard:parseInt(cacheKey.slice(0,8),16)%shardCount,
      cacheKey,definitionHash:c.definitionHash,status:'queued' as const,maxAttempts:3}
  }).sort((a,b)=>a.shard-b.shard||a.id.localeCompare(b.id))
}

/** A durable local checkpoint for a specific content-addressed render job. */
export type B8QueueJobState = B8ShardJob & {
  attempts: number
  runStatus: 'queued' | 'running' | 'rendered' | 'failed' | 'done' | 'canceled'
  error?: string
  claimedAt?: string
  renderEvidence?: string
}

/**
 * Idempotently reconcile the 2,000-job manifest. Re-running 'jobs' must never
 * erase a successful render, reclaim an active job, or retry a failed job
 * without an explicit operator action. Only changed cache keys are reset.
 * A changed definition/fixture/renderer cannot replace an active worker lease.
 */
export function reconcileB8Queue(
  planned: readonly B8ShardJob[],
  prior: readonly B8QueueJobState[] = [],
): B8QueueJobState[] {
  const wanted = new Map(planned.map(job => [job.id, job]))
  const previous = new Map(prior.map(job => [job.id, job]))
  if (wanted.size !== planned.length || previous.size !== prior.length)
    throw new Error('Duplicate Batch 8 job IDs in checkpoint')
  for (const old of prior) {
    const next = wanted.get(old.id)
    if (old.runStatus === 'running' && (!next ||
        next.cacheKey !== old.cacheKey || next.definitionHash !== old.definitionHash))
      throw new Error('Cannot replace an active Batch 8 worker lease: ' + old.id)
  }
  return planned.map(job => {
    const old = previous.get(job.id)
    if (!old || old.cacheKey !== job.cacheKey || old.definitionHash !== job.definitionHash)
      return { ...job, attempts: 0, runStatus: 'queued' as const }
    if (!Number.isInteger(old.attempts) || old.attempts < 0 ||
        old.attempts > job.maxAttempts ||
        !['queued','running','rendered','failed','done','canceled'].includes(old.runStatus))
      throw new Error('Corrupt Batch 8 checkpoint for ' + job.id)
    return {
      ...job, attempts: old.attempts, runStatus: old.runStatus,
      ...(old.error ? { error: old.error } : {}),
      ...(old.claimedAt ? { claimedAt: old.claimedAt } : {}),
      ...(old.renderEvidence ? { renderEvidence: old.renderEvidence } : {}),
    }
  })
}
