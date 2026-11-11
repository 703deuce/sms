import 'server-only'

import { createHash } from 'node:crypto'
import { createId } from '@/lib/supabase/id'
import { getPrisma } from '@/lib/server/db'
import { normalizeEdits, type ClipEditsV2 } from '@/lib/clips/edits'
import { defaultClipSettings } from '@/lib/clips/settings'
import { toPrismaJson } from '@/lib/server/clips/prisma-json'
import type {
  UserTemplateAssetManifestV1,
  UserTemplateDefinitionV1,
  UserTemplateInspectionV1,
  UserTemplateSlotV1,
  UserTemplateDecorativeAssetV1,
} from '@/lib/clips/user-templates/contract'

const SAFE_ID = /^[A-Za-z0-9_:.~-]{1,120}$/
const MAX_TEMPLATE_BYTES = 2_000_000
const RESERVED_INSERT_SOURCES = new Set(['freeze','gap'])

function obj(v: unknown): v is Record<string, unknown> {
  return Boolean(v) && typeof v === 'object' && !Array.isArray(v)
}
function clone<T>(v: T): T { return JSON.parse(JSON.stringify(v)) as T }
function title(v: string): string {
  const s = v.replace(/[\u0000-\u001f\u007f]/g,' ').replace(/\s+/g,' ').trim().slice(0,120)
  if (!s) throw new Error('Template title is required')
  return s
}
function description(v: string | undefined): string {
  return (v ?? '').replace(/[\u0000-\u001f\u007f]/g,' ').trim().slice(0,1000)
}
function containsInjectedUrl(value: unknown): boolean {
  if (typeof value === 'string') return /^(?:javascript|data|blob):/i.test(value.trim()) || /^https?:\/\//i.test(value.trim())
  if (Array.isArray(value)) return value.some(containsInjectedUrl)
  if (obj(value)) return Object.values(value).some(containsInjectedUrl)
  return false
}
function stripPrivateMetadata(edits: ClipEditsV2): ClipEditsV2 {
  const out = clone(edits) as ClipEditsV2 & Record<string, unknown>
  delete out.cutQualityMeta
  delete out.cleanTakeReview
  delete out.templateProvenance
  delete out.speakerNames
  delete out.vocabApplied
  delete out.motionPlan
  return out
}
function sourceNeedMs(edits: ClipEditsV2, sourceId: string): number {
  let need = 0
  for (const s of edits.sourceSegments ?? []) {
    if (s.sourceId !== sourceId) continue
    const inMs = s.inMs ?? 0
    const span = Math.max(0, s.endMs - s.startMs)
    let consumed = span * (s.speed ?? 1)
    if (s.playback) consumed = s.playback.pieces.reduce((sum,p) =>
      sum + (p.kind === 'play' ? p.frames * p.rate * 1000 / 30 : 0), 0)
    need = Math.max(need, inMs + consumed)
  }
  for (const i of edits.inserts ?? []) {
    if (i.sourceId === sourceId) need = Math.max(need, i.inMs + i.durMs)
  }
  return Math.ceil(need)
}
function usedSourceIds(edits: ClipEditsV2): Set<string> {
  return new Set([
    ...(edits.sourceSegments ?? []).map(s=>s.sourceId),
    ...(edits.inserts ?? []).map(i=>i.sourceId).filter(id=>!RESERVED_INSERT_SOURCES.has(id)),
  ])
}
function brollKey(id: string) { return 'broll:' + id }
function sourceKey(id: string) { return 'source:' + id }

async function loadClip(workspaceId: string, clipId: string) {
  const row = await getPrisma().clip.findFirst({
    where: { id: clipId, workspaceId, deletedAt: null },
    select: {
      id:true,startMs:true,endMs:true,edits:true,editsSaveVersion:true,title:true,
      project:{select:{id:true,workspaceId:true,uploadId:true,settings:true,
        upload:{select:{id:true,filename:true,mime:true,durationMs:true,status:true}}}},
    },
  })
  if (!row || row.project.workspaceId !== workspaceId) throw new Error('Clip not found')
  const edits = normalizeEdits(row.edits, { clipStartMs: row.startMs, clipEndMs: row.endMs })
  return { row, edits }
}

export async function inspectClipForUserTemplate(
  workspaceId: string, clipId: string,
): Promise<UserTemplateInspectionV1> {
  const { row, edits } = await loadClip(workspaceId, clipId)
  const sources = new Map((edits.sources ?? []).map(s=>[s.id,s]))
  const used = usedSourceIds(edits)
  const replaceable: UserTemplateInspectionV1['replaceable'] = []
  const decorative: UserTemplateInspectionV1['decorativeDependencies'] = []
  if (row.project.uploadId) {
    replaceable.push({ key:'main', label:'Main video', media:'video',
      minDurationMs: Math.max(1, edits.trim.out), })
    decorative.push({ key:'main:' + row.project.uploadId, label:'Keep main source as decorative media', kind:'upload' })
  }
  for (const sourceId of used) {
    const s = sources.get(sourceId)
    if (!s || s.ref !== 'upload') throw new Error('Template save cannot preserve Rooms/take media yet; replace it with a workspace upload first')
    replaceable.push({ key:sourceKey(sourceId), label:s.label?.slice(0,80) || 'Media clip',
      media:s.mediaType === 'video' ? 'video' : s.mediaType === 'image' ? 'image' : 'either',
      minDurationMs: sourceNeedMs(edits, sourceId) })
    decorative.push({ key:sourceKey(sourceId), label:'Keep ' + (s.label?.slice(0,80) || 'media clip'), kind:'upload' })
  }
  for (const item of edits.broll ?? []) {
    replaceable.push({ key:brollKey(item.id), label:'Overlay ' + item.id.slice(0,40),
      media:'either', minDurationMs:Math.max(1,(item.inMs ?? 0) + item.endMs-item.startMs) })
    const dep = item.source === 'upload' ? 'upload:' + item.uploadId :
      item.source === 'stock' ? 'stock:' + item.assetId : 'generation:' + item.generationId
    decorative.push({ key:brollKey(item.id) + ':' + dep, label:'Keep overlay ' + item.id.slice(0,40), kind:item.source })
  }
  const textFields = (edits.textItems ?? []).filter(t=>!t.kind).map(t=>({
    id:t.id,label:'Text · ' + t.id.slice(0,40),text:t.text,maxChars:200,
  }))
  for (const t of edits.textItems ?? []) {
    if (typeof t.style.font === 'string' && t.style.font.startsWith('user:'))
      decorative.push({ key:'font:' + t.style.font.slice(5), label:'Workspace font ' + (t.style.fontFamily ?? t.style.font), kind:'font' })
  }
  const music = edits.audio?.music
  if (music) {
    const id = music.uploadId ?? music.generationId
    decorative.push({ key:'music:' + id, label:'Current soundtrack', kind:music.uploadId ? 'upload' : 'generation' })
  }
  return {
    clipId:row.id, editsSaveVersion:row.editsSaveVersion,
    durationMs:Math.max(1,row.endMs-row.startMs),
    aspect:String(edits.aspectRatio ?? '9:16'),
    replaceable, textFields, decorativeDependencies:decorative,
    musicPresent:Boolean(music),
    warnings:[
      ...(edits.inserts?.length ? ['Inserted footage remains editable and follows its source slot/decorative-media choice.'] : []),
      ...(edits.broll?.length ? ['B-roll stays a separate editable layer unless you explicitly make it a replaceable slot.'] : []),
    ],
  }
}

type SaveInput = {
  clipId: string
  title: string
  description?: string
  replaceableItemKeys: string[]
  editableTextIds: string[]
  decorativeAssetKeys: string[]
  musicPolicy: 'keep' | 'replace' | 'mute'
  previewRange?: { startMs: number; endMs: number }
}
type Built = { definition: UserTemplateDefinitionV1; manifest: UserTemplateAssetManifestV1; fingerprint: string }

async function buildFromClip(workspaceId:string,input:SaveInput):Promise<Built> {
  const {row,edits:normalized}=await loadClip(workspaceId,input.clipId)
  if (JSON.stringify(normalized).length > MAX_TEMPLATE_BYTES) throw new Error('This edit is too large to save as a reusable template')
  if (containsInjectedUrl(normalized)) throw new Error('Template contains an external URL; import that asset into the workspace first')
  const edits=stripPrivateMetadata(normalized)
  const selected=new Set(input.replaceableItemKeys)
  const decorative=new Set(input.decorativeAssetKeys)
  const slots:UserTemplateSlotV1[]=[]
  const manifestDecorative:UserTemplateDecorativeAssetV1[]=[]
  let ordinal=1

  if (!row.project.uploadId) throw new Error('Template needs a workspace-owned main video')
  if (selected.has('main')) {
    slots.push({id:'slot_'+ordinal,ordinal,label:'Clip '+ordinal,media:'video',target:{kind:'main'},minDurationMs:Math.max(1,edits.trim.out)})
    ordinal++
  } else {
    const key='main:'+row.project.uploadId
    if (!decorative.has(key)) throw new Error('Choose the main video as a replaceable slot or intentionally preserve it as decorative media')
    manifestDecorative.push({key,kind:'upload',assetId:row.project.uploadId,media:'video',redistributionCleared:false})
  }

  const sources=edits.sources ?? []
  const used=usedSourceIds(edits)
  const sourceIdMap=new Map<string,string>()
  const nextSources=[]
  for(const src of sources){
    if(!used.has(src.id)) continue
    if(src.ref!=='upload') throw new Error('Rooms/take sources are unsupported in reusable templates; convert them to workspace uploads')
    const key=sourceKey(src.id)
    if(selected.has(key)){
      const slotId='slot_'+ordinal
      const nextId='template_source_'+ordinal
      slots.push({id:slotId,ordinal,label:'Clip '+ordinal,
        media:src.mediaType==='video'?'video':src.mediaType==='image'?'image':'either',
        target:{kind:'source',sourceId:nextId},minDurationMs:sourceNeedMs(edits,src.id)})
      sourceIdMap.set(src.id,nextId)
      nextSources.push({...src,id:nextId,refId:'template_'+slotId,label:'Replaceable clip',syncMs:undefined})
      ordinal++
    }else{
      if(!decorative.has(key)) throw new Error('Choose '+key+' as a slot or explicitly preserve it as decorative media')
      sourceIdMap.set(src.id,src.id)
      nextSources.push({...src,label:'Decorative media'})
      manifestDecorative.push({key,kind:'upload',assetId:src.refId,media:src.mediaType,redistributionCleared:false})
    }
  }
  edits.sources=nextSources.length?nextSources:undefined
  edits.sourceSegments=edits.sourceSegments?.map(seg=>({...seg,sourceId:sourceIdMap.get(seg.sourceId) ?? seg.sourceId}))
  edits.inserts=edits.inserts?.map(ins=>RESERVED_INSERT_SOURCES.has(ins.sourceId)?ins:
    ({...ins,sourceId:sourceIdMap.get(ins.sourceId) ?? ins.sourceId}))

  edits.broll=edits.broll?.map(item=>{
    const key=brollKey(item.id)
    if(selected.has(key)){
      const slotId='slot_'+ordinal
      slots.push({id:slotId,ordinal,label:'Clip '+ordinal,media:'either',
        target:{kind:'broll',itemId:item.id},minDurationMs:Math.max(1,(item.inMs??0)+item.endMs-item.startMs)})
      ordinal++
      return {...item,source:'upload' as const,uploadId:'template_'+slotId}
    }
    const dep=item.source==='upload'?'upload:'+item.uploadId:item.source==='stock'?'stock:'+item.assetId:'generation:'+item.generationId
    const explicit=key+':'+dep
    if(!decorative.has(explicit)) throw new Error('Choose '+key+' as a slot or explicitly preserve that overlay')
    manifestDecorative.push({key:explicit,kind:item.source==='upload'?'upload':item.source==='stock'?'stock':'generation',
      assetId:item.source==='upload'?item.uploadId:item.source==='stock'?item.assetId:item.generationId,
      media:item.source==='upload'?(item.still?'image':'video'):undefined,redistributionCleared:false})
    return item
  })

  const requestedText=new Set(input.editableTextIds)
  const textFields=(edits.textItems??[]).filter(t=>requestedText.has(t.id) && !t.kind).map(t=>({
    id:'field_'+t.id,itemId:t.id,label:'Text '+(t.id.slice(0,32)),exampleText:t.text,maxChars:200,
  }))
  if(requestedText.size!==textFields.length) throw new Error('One or more selected text fields no longer exist')

  const fontIds=[...new Set((edits.textItems??[]).map(t=>String(t.style.font)).filter(f=>f.startsWith('user:')).map(f=>f.slice(5)))]
  for(const id of fontIds){
    const key='font:'+id
    if(!decorative.has(key)) throw new Error('Workspace font '+id+' must be intentionally preserved or replaced with a built-in font')
    manifestDecorative.push({key,kind:'font',assetId:id,redistributionCleared:false})
  }

  const music=edits.audio?.music
  if(music){
    const id=music.uploadId??music.generationId
    if(input.musicPolicy==='mute'){
      if(edits.audio) edits.audio={...edits.audio,music:null}
      edits.keyframes=edits.keyframes?.filter(k=>k.target!=='music')
    }else if(input.musicPolicy==='replace'){
      if(edits.audio) edits.audio={...edits.audio,music:{...music,generationId:'template_music',uploadId:'template_music'}}
    }else{
      const key='music:'+id
      if(!decorative.has(key)) throw new Error('Current soundtrack must be explicitly preserved, made replaceable, or muted')
      manifestDecorative.push({key,kind:music.uploadId?'upload':'generation',assetId:id,media:'audio',redistributionCleared:false})
    }
  }else if(input.musicPolicy!=='mute') {
    throw new Error('This edit has no soundtrack to preserve or replace')
  }

  const uploadIds=manifestDecorative.filter(x=>x.kind==='upload').map(x=>x.assetId)
  if(uploadIds.length){
    const count=await getPrisma().clipUpload.count({where:{workspaceId,status:'COMPLETE',id:{in:[...new Set(uploadIds)]}}})
    if(count!==new Set(uploadIds).size) throw new Error('A preserved upload is missing or belongs to another workspace')
  }
  const fontRows=manifestDecorative.filter(x=>x.kind==='font').map(x=>x.assetId)
  if(fontRows.length){
    const count=await getPrisma().clipFont.count({where:{workspaceId,deletedAt:null,id:{in:[...new Set(fontRows)]}}})
    if(count!==new Set(fontRows).size) throw new Error('A preserved font is missing or belongs to another workspace')
  }
  const generationIds=manifestDecorative.filter(x=>x.kind==='generation').map(x=>x.assetId)
  if(generationIds.length){
    const count=await getPrisma().aiGeneration.count({where:{workspaceId,id:{in:[...new Set(generationIds)]},status:'READY'}})
    if(count!==new Set(generationIds).size) throw new Error('A preserved generated asset is unavailable in this workspace')
  }

  const clipDuration=Math.max(1,row.endMs-row.startMs)
  const pr=input.previewRange??{startMs:0,endMs:Math.min(clipDuration,15_000)}
  const previewStart=Math.max(0,Math.min(clipDuration-1,Math.round(pr.startMs)))
  const previewEnd=Math.max(previewStart+1,Math.min(clipDuration,Math.round(pr.endMs)))
  const definition:UserTemplateDefinitionV1={
    v:1,
    snapshot:{edits,editsSaveVersion:row.editsSaveVersion,clipStartMs:row.startMs,clipEndMs:row.endMs,
      aspect:String(edits.aspectRatio??'9:16')},
    slots,textFields,previewRange:{startMs:previewStart,endMs:previewEnd},
    capabilities:{
      transitions:Boolean(edits.transitions?.length),keyframes:Boolean(edits.keyframes?.length),
      sourcePlayback:Boolean(edits.sourceSegments?.some(s=>s.playback)),
      textLayers:Boolean(edits.textItems?.length),graphics:Boolean(edits.textItems?.some(t=>Boolean(t.kind))),
      music:Boolean(edits.audio?.music),
    },
  }
  const manifest:UserTemplateAssetManifestV1={v:1,slots,decorative:manifestDecorative,musicPolicy:input.musicPolicy}
  if(containsInjectedUrl(definition)||containsInjectedUrl(manifest)) throw new Error('Template definition contains an external URL')
  const fingerprint=createHash('sha256').update(JSON.stringify({definition,manifest})).digest('hex')
  return {definition,manifest,fingerprint}
}

export async function createPrivateUserTemplate(workspaceId:string,actorUserId:string,input:SaveInput){
  const built=await buildFromClip(workspaceId,input)
  const templateId=createId('utpl'), revisionId=createId('utrev')
  return getPrisma().$transaction(async tx=>{
    const template=await tx.clipUserTemplate.create({data:{
      id:templateId,workspaceId,createdById:actorUserId,title:title(input.title),
      description:description(input.description),visibility:'private',currentRevision:1,
    }})
    await tx.clipUserTemplateRevision.create({data:{
      id:revisionId,templateId,workspaceId,revision:1,definition:toPrismaJson(built.definition),
      assetManifest:toPrismaJson(built.manifest),sourceFingerprint:built.fingerprint,createdById:actorUserId,
    }})
    return {...template,revisionId}
  })
}

export async function addUserTemplateRevision(workspaceId:string,actorUserId:string,templateId:string,input:SaveInput){
  const built=await buildFromClip(workspaceId,input)
  return getPrisma().$transaction(async tx=>{
    const template=await tx.clipUserTemplate.findFirst({where:{id:templateId,workspaceId,deletedAt:null}})
    if(!template) throw new Error('Template not found')
    const revision=template.currentRevision+1
    const row=await tx.clipUserTemplateRevision.create({data:{
      id:createId('utrev'),templateId,workspaceId,revision,definition:toPrismaJson(built.definition),
      assetManifest:toPrismaJson(built.manifest),sourceFingerprint:built.fingerprint,createdById:actorUserId,
    }})
    await tx.clipUserTemplate.update({where:{id:templateId},data:{
      currentRevision:revision,title:title(input.title),description:description(input.description),
    }})
    return row
  })
}

export async function listPrivateUserTemplates(workspaceId:string,q:string,page:number){
  const take=30, safePage=Math.max(1,Math.min(10000,page))
  const where={workspaceId,deletedAt:null,...(q.trim()?{title:{contains:q.trim().slice(0,120),mode:'insensitive' as const}}:{})}
  const [total,rows]=await Promise.all([
    getPrisma().clipUserTemplate.count({where}),
    getPrisma().clipUserTemplate.findMany({where,orderBy:{updatedAt:'desc'},take,skip:(safePage-1)*take,
      select:{id:true,title:true,description:true,currentRevision:true,updatedAt:true,
        revisions:{orderBy:{revision:'desc'},take:1,select:{definition:true,assetManifest:true,revision:true}}}},
  ])
  return {items:rows,total,page:safePage,pages:Math.max(1,Math.ceil(total/take))}
}

export async function getPrivateUserTemplate(workspaceId:string,templateId:string,revision?:number){
  const template=await getPrisma().clipUserTemplate.findFirst({where:{id:templateId,workspaceId,deletedAt:null},
    select:{id:true,title:true,description:true,currentRevision:true,updatedAt:true}})
  if(!template) throw new Error('Template not found')
  const rev=await getPrisma().clipUserTemplateRevision.findFirst({where:{
    templateId,workspaceId,revision:revision??template.currentRevision}})
  if(!rev) throw new Error('Template revision not found')
  return {...template,revision:rev}
}

export async function renamePrivateUserTemplate(workspaceId:string,templateId:string,input:{title?:string;description?:string}){
  const existing=await getPrisma().clipUserTemplate.findFirst({where:{id:templateId,workspaceId,deletedAt:null},select:{id:true}})
  if(!existing) throw new Error('Template not found')
  return getPrisma().clipUserTemplate.update({where:{id:templateId},data:{
    ...(input.title!==undefined?{title:title(input.title)}:{}),
    ...(input.description!==undefined?{description:description(input.description)}:{}),
  }})
}

export async function softDeletePrivateUserTemplate(workspaceId:string,templateId:string){
  const row=await getPrisma().clipUserTemplate.findFirst({where:{id:templateId,workspaceId,deletedAt:null},select:{id:true}})
  if(!row) throw new Error('Template not found')
  await getPrisma().clipUserTemplate.update({where:{id:templateId},data:{deletedAt:new Date()}})
}

export async function duplicatePrivateUserTemplate(workspaceId:string,actorUserId:string,templateId:string){
  const source=await getPrivateUserTemplate(workspaceId,templateId)
  const id=createId('utpl'), revId=createId('utrev')
  return getPrisma().$transaction(async tx=>{
    const template=await tx.clipUserTemplate.create({data:{id,workspaceId,createdById:actorUserId,
      title:title(source.title+' copy'),description:source.description,visibility:'private',currentRevision:1}})
    await tx.clipUserTemplateRevision.create({data:{id:revId,templateId:id,workspaceId,revision:1,
      definition:source.revision.definition,assetManifest:source.revision.assetManifest,
      sourceFingerprint:source.revision.sourceFingerprint,createdById:actorUserId}})
    return {...template,revisionId:revId}
  })
}

function parseDefinition(raw:unknown):UserTemplateDefinitionV1{
  if(!obj(raw)||raw.v!==1||!obj(raw.snapshot)||!Array.isArray(raw.slots)||!Array.isArray(raw.textFields))
    throw new Error('Template revision is corrupt')
  return raw as unknown as UserTemplateDefinitionV1
}
function parseManifest(raw:unknown):UserTemplateAssetManifestV1{
  if(!obj(raw)||raw.v!==1||!Array.isArray(raw.slots)||!Array.isArray(raw.decorative))
    throw new Error('Template asset manifest is corrupt')
  return raw as unknown as UserTemplateAssetManifestV1
}

export async function usePrivateUserTemplate(workspaceId:string,actorUserId:string,templateId:string,input:{
  revision?:number
  fills:Record<string,string>
  text?:Record<string,string>
  musicUploadId?:string
}){
  const loaded=await getPrivateUserTemplate(workspaceId,templateId,input.revision)
  const definition=parseDefinition(loaded.revision.definition)
  const manifest=parseManifest(loaded.revision.assetManifest)
  const edits=clone(definition.snapshot.edits)
  const fillIds=Object.values(input.fills)
  const decorativeUploads=manifest.decorative.filter(x=>x.kind==='upload').map(x=>x.assetId)
  const allUploadIds=[...new Set([...fillIds,...decorativeUploads,...(input.musicUploadId?[input.musicUploadId]:[])])]
  const uploads=allUploadIds.length?await getPrisma().clipUpload.findMany({where:{workspaceId,status:'COMPLETE',id:{in:allUploadIds}},
    select:{id:true,filename:true,mime:true,durationMs:true,width:true,height:true}}):[]
  const byUpload=new Map(uploads.map(u=>[u.id,u]))
  if(byUpload.size!==allUploadIds.length) throw new Error('One or more selected assets are missing or belong to another workspace')
  const slotById=new Map(definition.slots.map(s=>[s.id,s]))
  for(const slot of definition.slots){
    const uploadId=input.fills[slot.id]
    const upload=uploadId?byUpload.get(uploadId):undefined
    if(!upload) throw new Error('Fill every numbered slot before creating the project')
    const media=upload.mime.startsWith('image/')?'image':upload.mime.startsWith('video/')?'video':upload.mime.startsWith('audio/')?'audio':'other'
    if(slot.target.kind==='main' && media!=='video') throw new Error('The main slot requires a video')
    if(slot.media!=='either'&&slot.media!==media) throw new Error(slot.label+' requires '+slot.media)
    if(media==='video'&&(!upload.durationMs||upload.durationMs<slot.minDurationMs))
      throw new Error(slot.label+' needs at least '+Math.ceil(slot.minDurationMs/1000)+' seconds of source media')
    if(slot.target.kind==='source'){
      edits.sources=edits.sources?.map(src=>src.id===slot.target.sourceId?{...src,ref:'upload' as const,refId:upload.id,
        mediaType:media as 'video'|'image',durationMs:upload.durationMs??undefined,label:slot.label}:src)
    }else if(slot.target.kind==='broll'){
      edits.broll=edits.broll?.map(item=>item.id===slot.target.itemId?{
        ...item,source:'upload' as const,uploadId:upload.id,...(media==='image'?{still:true as const}:{still:undefined}),
      }:item)
    }
  }
  if(Object.keys(input.fills).some(id=>!slotById.has(id))) throw new Error('Unknown template slot')
  const textById=new Map(definition.textFields.map(f=>[f.id,f]))
  for(const [fieldId,value] of Object.entries(input.text??{})){
    const field=textById.get(fieldId)
    if(!field) throw new Error('Unknown editable text field')
    const next=Array.from(String(value).replace(/\r/g,'')).slice(0,field.maxChars).join('')
    if(!next.trim()) throw new Error(field.label+' cannot be empty')
    edits.textItems=edits.textItems?.map(item=>item.id===field.itemId?{...item,text:next}:item)
  }
  if(manifest.musicPolicy==='replace'){
    const upload=input.musicUploadId?byUpload.get(input.musicUploadId):undefined
    if(!upload||!upload.mime.startsWith('audio/')) throw new Error('Choose workspace audio for the replaceable soundtrack')
    if(edits.audio?.music) edits.audio={...edits.audio,music:{...edits.audio.music,generationId:upload.id,uploadId:upload.id}}
  }
  const mainSlot=definition.slots.find(s=>s.target.kind==='main')
  const mainAssetId=mainSlot?input.fills[mainSlot.id]:
    manifest.decorative.find(x=>x.key.startsWith('main:')&&x.kind==='upload')?.assetId
  const main=mainAssetId?byUpload.get(mainAssetId):undefined
  if(!main||!main.durationMs||!main.mime.startsWith('video/')) throw new Error('Template main video is unavailable')
  if(main.durationMs<definition.snapshot.clipEndMs)
    throw new Error('Main video is shorter than the saved trim range; choose a longer source')

  const projectId=createId('proj'),clipId=createId('clip')
  const settings={...defaultClipSettings(),byo:true,fullVideo:true,rangeStartMs:0,rangeEndMs:main.durationMs,
    aspectRatio:definition.snapshot.aspect}
  const secondaryUploads=new Set<string>()
  for(const src of edits.sources??[]) if(src.ref==='upload'&&src.refId!==main.id) secondaryUploads.add(src.refId)
  for(const item of edits.broll??[]) if(item.source==='upload'&&item.uploadId!==main.id) secondaryUploads.add(item.uploadId)
  if(edits.audio?.music?.uploadId&&edits.audio.music.uploadId!==main.id) secondaryUploads.add(edits.audio.music.uploadId)

  await getPrisma().$transaction(async tx=>{
    await tx.clipProject.create({data:{id:projectId,workspaceId,createdById:actorUserId,
      title:(loaded.title+' copy').slice(0,200),uploadId:main.id,settings:toPrismaJson(settings),
      rangeStartMs:0,rangeEndMs:main.durationMs,status:'READY',stage:'ready',progress:100,sourceKind:'template'}})
    await tx.clip.create({data:{id:clipId,projectId,workspaceId,title:loaded.title.slice(0,200),
      reason:'user_template',startMs:definition.snapshot.clipStartMs,endMs:definition.snapshot.clipEndMs,
      edits:toPrismaJson(edits),editsSaveVersion:0,aiMeta:toPrismaJson({
        userTemplate:{templateId,revision:loaded.revision.revision,sourceFingerprint:loaded.revision.sourceFingerprint},
      })}})
    for(const uploadId of secondaryUploads){
      const u=byUpload.get(uploadId)
      if(!u) continue
      await tx.clipProjectMedia.create({data:{id:createId('media'),projectId,workspaceId,uploadId,
        mediaType:u.mime.startsWith('image/')?'image':u.mime.startsWith('audio/')?'audio':'video',
        label:'Template media',durationMs:u.durationMs,width:u.width,height:u.height}})
    }
  })
  return {projectId,clipId,templateId,revision:loaded.revision.revision}
}
