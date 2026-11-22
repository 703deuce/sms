import {MS_VIDEO_TYPES,MS_CREATIVE_STYLES, type MsCreativeBrief, type MsCreativeStyle, type MsVideoType} from './creative-options'
import type { MsWorkflow } from './types'

export type InputRole = 'footage'|'photo'|'talking_head'|'narration'|'music'|'reference'|'logo'|'script'
export type ProductionInput = { uploadId:string; filename:string; mime:string; role:InputRole; handling:string }
export type ProductionBrief = {
  prompt:string; workflow?:MsWorkflow; videoType:MsVideoType; durationSeconds:number
  aspectRatio:'16:9'|'9:16'|'1:1'; resolution:'480p'|'720p'|'1080p'
  style:{id:MsCreativeStyle;custom?:string}; brand?:MsCreativeBrief
  audience?:string; goal?:string; callToAction?:string; footageType?:string; captionsEnabled?:boolean
  voiceoverAmount?:'none'|'occasional'|'mostly';reviewPlan?:boolean
  tone?:{preset?:string;text?:string}
  script?:{text?:string;uploadId?:string;role:'script';handling:'exact'|'improve'}
  commentary?:{text:string;role:'commentary';handling:'creator_opinion'}
  referenceLinks?:{url:string;note?:string;role:'reference_link';handling:'include_in_research'}[]
  narration:{mode:'none'|'ai_voice'|'cloned_voice'|'uploaded_narration'|'talking_head';voiceId?:string;voiceName?:string;voiceSource?:'stock'|'cloned'|'auto';uploadId?:string;handling:'no_narration'|'tts_with_voice_id'|'tts_auto_voice'|'voiceover_drives_timing'|'preserve_talking_head'}
  music:{mode:'elevenlabs'|'upload'|'none';uploadId?:string;placement?:string;role:'music';handling:'paid_generate'|'use_uploaded_track'|'no_music'}
  sourcePreferences?:{text?:string;preferPrimaryFootage?:boolean;preferOriginalInterviews?:boolean;preferDocuments?:boolean;domains?:string[];handling:'honor_source_preferences'}
  inputs:ProductionInput[]
}
const object=(x:unknown):Record<string,unknown>=>x&&typeof x==='object'&&!Array.isArray(x)?x as Record<string,unknown>:{}
const str=(x:unknown,max=4000)=>typeof x==='string'?x.trim().slice(0,max):''
const allowedRoles:InputRole[]=['footage','photo','talking_head','narration','music','reference','logo','script']
export const roleHandling:Record<InputRole,string>={
 footage:'use_as_picture',photo:'use_as_still',talking_head:'preserve_picture_and_sound_add_cutaways',
 narration:'voiceover_drives_timing',music:'use_uploaded_track',reference:'visual_direction_only',
 logo:'apply_brand_identity',script:'use_customer_script'
}
export function sanitizeProductionBrief(raw:unknown):ProductionBrief{
 const x=object(raw),n=object(x.narration),m=object(x.music),sty=object(x.style)
 const prompt=str(x.prompt,15000)
 const declaredMode=['none','ai_voice','cloned_voice','uploaded_narration','talking_head'].includes(String(n.mode))?String(n.mode) as ProductionBrief['narration']['mode']:'ai_voice'
 const uploadedRoles=(Array.isArray(x.inputs)?x.inputs:[]).map(v=>object(v).role)
 const mode=declaredMode==='ai_voice'
   ? (uploadedRoles.includes('talking_head')?'talking_head':uploadedRoles.includes('narration')?'uploaded_narration':'ai_voice')
   : declaredMode
 const voiceId=str(n.voiceId,120),uploadId=str(n.uploadId,120)
 const voiceSource=['stock','cloned','auto'].includes(String(n.voiceSource))?n.voiceSource as 'stock'|'cloned'|'auto':undefined
 const inputs=(Array.isArray(x.inputs)?x.inputs:[]).slice(0,100).map(rawInput=>{
  const inp=object(rawInput),mime=str(inp.mime,100),role=allowedRoles.includes(inp.role as InputRole)?inp.role as InputRole:undefined
  if(!role||!str(inp.uploadId,120)||!mime)throw Error('Invalid production input')
  if((role==='talking_head'||role==='footage')&&!mime.startsWith('video/'))throw Error('Camera footage must be video')
  if((role==='narration'||role==='music')&&!mime.startsWith('audio/'))throw Error('Narration and music must be audio')
  if((role==='photo'||role==='logo')&&!mime.startsWith('image/'))throw Error('Photos and logos must be images')
  if(role==='reference'&&!mime.startsWith('image/')&&!mime.startsWith('video/'))throw Error('Reference must be a picture or video')
  return {uploadId:str(inp.uploadId,120),filename:str(inp.filename,180),mime,role,handling:roleHandling[role]}
 })
 const musicUpload=str(m.uploadId,120)||inputs.find(i=>i.role==='music')?.uploadId
 const narrationRole=mode==='uploaded_narration'?'narration':mode==='talking_head'?'talking_head':undefined
 const narrationUpload=uploadId||(narrationRole?inputs.find(i=>i.role===narrationRole)?.uploadId:undefined)
 if(mode==='cloned_voice'&&!voiceId)throw Error('Select a saved voice')
 if(mode==='cloned_voice'&&voiceSource!=='cloned')throw Error('Select a saved cloned voice')
 if((mode==='uploaded_narration'||mode==='talking_head')&&!narrationUpload)throw Error('Upload or record narration')
 const musicMode=m.mode==='none'?'none':m.mode==='upload'||musicUpload?'upload':'elevenlabs'
 if(musicMode==='upload'&&!musicUpload)throw Error('Select a music track')
 const script=object(x.script),scriptText=str(script.text,60000),scriptUpload=str(script.uploadId,120)
 const ref=(Array.isArray(x.referenceLinks)?x.referenceLinks:[]).slice(0,25).map(item=>{
   const link=object(item),url=str(link.url,2000);let valid:URL
   try{valid=new URL(url)}catch{throw Error('Invalid reference URL')}
   if(!['https:','http:'].includes(valid.protocol))throw Error('Reference links must be web URLs')
   return {url:valid.href,note:str(link.note,250),role:'reference_link' as const,handling:'include_in_research' as const}
 })
 const commentary=str(object(x.commentary).text,10000)
 const src=object(x.sourcePreferences)
 const sourceText=str(src.text,3000)
 const domains=(Array.isArray(src.domains)?src.domains:[]).slice(0,25).map(v=>str(v,120)).filter(Boolean)
 const hasSource=Boolean(sourceText||domains.length||src.preferPrimaryFootage||src.preferOriginalInterviews||src.preferDocuments)
 return {
  prompt,workflow:['idea','script','footage'].includes(String(x.workflow))?x.workflow as MsWorkflow:'idea',
  videoType:MS_VIDEO_TYPES.some(t=>t.id===x.videoType)?x.videoType as MsVideoType:'anything',
  durationSeconds:Number.isFinite(Number(x.durationSeconds))?Math.max(5,Math.min(2147483,Math.floor(Number(x.durationSeconds)))):30,
  aspectRatio:['16:9','9:16','1:1'].includes(String(x.aspectRatio))?x.aspectRatio as ProductionBrief['aspectRatio']:'16:9',
  resolution:['480p','720p','1080p'].includes(String(x.resolution))?x.resolution as ProductionBrief['resolution']:'480p',
  style:{id:MS_CREATIVE_STYLES.includes(sty.id as MsCreativeStyle)?sty.id as MsCreativeStyle:'automatic',...(str(sty.custom,1000)?{custom:str(sty.custom,1000)}:{})},
  ...(x.brand?{brand:x.brand as MsCreativeBrief}:{}),
  ...(str(x.audience,1000)?{audience:str(x.audience,1000)}:{}),
  ...(str(x.goal,1000)?{goal:str(x.goal,1000)}:{}),
  ...(str(x.callToAction,1000)?{callToAction:str(x.callToAction,1000)}:{}),
  ...(str(x.footageType,80)?{footageType:str(x.footageType,80)}:{}),
  captionsEnabled:x.captionsEnabled!==false,
  voiceoverAmount:['none','occasional','mostly'].includes(String(x.voiceoverAmount))
    ? x.voiceoverAmount as ProductionBrief['voiceoverAmount']:undefined,
  reviewPlan:x.reviewPlan!==false,
  ...(str(object(x.tone).preset,50)||str(object(x.tone).text,1000)?{tone:{
    preset:str(object(x.tone).preset,50)||undefined,text:str(object(x.tone).text,1000)||undefined}}:{}),
  ...(scriptText||scriptUpload?{script:{text:scriptText||undefined,uploadId:scriptUpload||undefined,
    role:'script',handling:script.handling==='improve'?'improve':'exact'}}:{}),
  ...(commentary?{commentary:{text:commentary,role:'commentary',handling:'creator_opinion'}}:{}),
  ...(ref.length?{referenceLinks:ref}:{}),
  narration:{mode,...(voiceId&&(mode==='ai_voice'||mode==='cloned_voice')?{voiceId,voiceName:str(n.voiceName,120),voiceSource}:{}),
    ...(mode==='ai_voice'&&voiceSource==='auto'?{voiceSource:'auto' as const}:{}),
    ...(narrationUpload?{uploadId:narrationUpload}:{}),
    handling:mode==='none'?'no_narration':mode==='talking_head'?'preserve_talking_head':mode==='uploaded_narration'?'voiceover_drives_timing':voiceId?'tts_with_voice_id':'tts_auto_voice'},
  music:{mode:musicMode,...(musicUpload?{uploadId:musicUpload}:{}),
    ...(str(m.placement,1000)?{placement:str(m.placement,1000)}:{}),role:'music',
    handling:musicMode==='none'?'no_music':musicMode==='upload'?'use_uploaded_track':'paid_generate'},
  ...(hasSource?{sourcePreferences:{text:sourceText||undefined,
    preferPrimaryFootage:Boolean(src.preferPrimaryFootage),
    preferOriginalInterviews:Boolean(src.preferOriginalInterviews),
    preferDocuments:Boolean(src.preferDocuments),domains,handling:'honor_source_preferences'}}:{}),
  inputs
 }
}
