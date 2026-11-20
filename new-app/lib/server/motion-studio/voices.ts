import 'server-only'
import {randomUUID} from 'node:crypto'
import {getPrisma} from '@/lib/server/db'
import {getClipStorage,createReadableSignedUrl} from '@/lib/storage'
import {getElevenLabsApiKey} from '@/lib/server/ai/elevenlabs'
import {MotionStudioError} from './errors'
import {MOTION_STOCK_VOICES} from '@/lib/motion-studio/stock-voices'

const db=()=>getPrisma()
const error=(message:string,status=400)=>new MotionStudioError('INVALID',message,status)
const name=(value:unknown)=>typeof value==='string'?value.trim().slice(0,80):''
const voiceIdPattern=/^[A-Za-z0-9_-]{10,80}$/
type VoiceRow={id:string;workspaceId:string;userId:string;voiceId:string;name:string;kind:string;sampleUploadId:string|null;previewUrl:string|null;isDefault:boolean}
type StockRow={id:string;voiceId:string;name:string;description:string;gender:string|null;accent:string|null;previewUrl:string;sortOrder:number;enabled:boolean}
let previews=new Map<string,{url:string;expires:number}>()
async function officialPreview(id:string){
 const cached=previews.get(id)
 if(cached&&cached.expires>Date.now())return cached.url
 try{
  const response=await fetch('https://api.elevenlabs.io/v1/voices/'+encodeURIComponent(id),{
   headers:{'xi-api-key':getElevenLabsApiKey()},signal:AbortSignal.timeout(10000),
   cache:'no-store'})
  if(!response.ok)return ''
  const data=await response.json() as {preview_url?:string}
  const url=data.preview_url&&new URL(data.preview_url).protocol==='https:'?data.preview_url:''
  previews.set(id,{url,expires:Date.now()+30*60_000})
  return url
 }catch{return ''}
}
export async function listVoices(workspaceId:string,userId:string){
 const my=await db().motionStudioVoice.findMany({
  where:{workspaceId,userId},orderBy:[{isDefault:'desc'},{createdAt:'desc'}]})
 const stock=await db().motionStudioStockVoice.findMany({
  where:{enabled:true},orderBy:{sortOrder:'asc'},take:20})
 const fallback=stock.length?stock:MOTION_STOCK_VOICES.map((x,i)=>({
  id:'seed_'+x.id,voiceId:x.id,name:x.name,description:x.description,
  gender:x.gender,accent:x.accent,previewUrl:'',sortOrder:i,enabled:true
 }))
 const stockVoices=await Promise.all(fallback.map(async row=>({
   voiceId:row.voiceId,name:row.name,description:row.description,gender:row.gender,
   accent:row.accent,previewUrl:row.previewUrl||await officialPreview(row.voiceId),source:'stock' as const,
 })))
 const myVoices=await Promise.all(my.map(async row=>{
   let previewUrl=row.previewUrl||await officialPreview(row.voiceId)
   if(!previewUrl&&row.sampleUploadId){
     const source=await db().clipUpload.findFirst({
       where:{id:row.sampleUploadId,workspaceId,status:'COMPLETE'},select:{key:true}})
     if(source)previewUrl=await createReadableSignedUrl(source.key,1800).catch(()=>'')
   }
   return {id:row.id,voiceId:row.voiceId,name:row.name,kind:row.kind,
     isDefault:row.isDefault,previewUrl,source:row.kind==='cloned'?'cloned' as const:'stock' as const}
 }))
 return {myVoices,stockVoices,defaultVoiceId:my.find(r=>r.isDefault)?.voiceId||null}
}
export async function validateChosenVoice(workspaceId:string,userId:string,voiceId:string,source:'cloned'|'stock'){
 if(!voiceIdPattern.test(voiceId))throw error('Invalid narrator voice')
 if(source==='cloned'){
  const row=await db().motionStudioVoice.findFirst({where:{workspaceId,userId,voiceId,kind:'cloned'}})
  if(!row)throw error('Choose one of your saved voices')
 }else{
  const row=await db().motionStudioStockVoice.findFirst({where:{voiceId,enabled:true}})
  if(!row&&!MOTION_STOCK_VOICES.some(v=>v.id===voiceId))throw error('Choose a listed stock voice')
 }
}
export async function defaultVoice(workspaceId:string,userId:string){
 const row=await db().motionStudioVoice.findFirst({where:{workspaceId,userId,isDefault:true}})
 return row?{voiceId:row.voiceId,voiceName:row.name,
   voiceSource:row.kind==='cloned'?'cloned' as const:'stock' as const}:null
}
export async function setDefaultVoice(workspaceId:string,userId:string,voiceId:string|null,source:'cloned'|'stock'='cloned'){
 if(voiceId)await validateChosenVoice(workspaceId,userId,voiceId,source)
 await db().$transaction(async tx=>{
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${workspaceId+':'+userId+':motion-voices'}))`
  await tx.motionStudioVoice.updateMany({where:{workspaceId,userId,isDefault:true},data:{isDefault:false}})
  if(voiceId){
   if(source==='stock'){
    const stock=await tx.motionStudioStockVoice.findFirst({where:{voiceId}})
    const chosen=stock||MOTION_STOCK_VOICES.find(v=>v.id===voiceId)
    await tx.motionStudioVoice.upsert({
     where:{workspaceId_userId_provider_voiceId:{workspaceId,userId,provider:'elevenlabs',voiceId}},
     update:{isDefault:true},
     create:{id:'msv_'+randomUUID(),workspaceId,userId,provider:'elevenlabs',voiceId,
       kind:'stock_favorite',name:chosen?.name||'Stock voice',isDefault:true},
    })
   }else{
    await tx.motionStudioVoice.updateMany({where:{workspaceId,userId,voiceId,kind:'cloned'},data:{isDefault:true}})
   }
  }
 })
 return defaultVoice(workspaceId,userId)
}
export async function createClone(workspaceId:string,userId:string,raw:unknown){
 const body=raw&&typeof raw==='object'?raw as {name?:unknown;sampleUploadId?:unknown}:{}
 const label=name(body.name),sampleUploadId=typeof body.sampleUploadId==='string'?body.sampleUploadId.trim():''
 if(label.length<2||!sampleUploadId)throw error('Enter a voice name and upload a sample.')
 const sample=await db().clipUpload.findFirst({
  where:{id:sampleUploadId,workspaceId,status:'COMPLETE'},select:{id:true,key:true,mime:true,bytes:true,durationMs:true}})
 if(!sample||!['audio/mpeg','audio/wav','audio/x-wav','audio/mp4','audio/m4a','audio/webm','audio/ogg'].includes(sample.mime))
  throw error('Upload a supported audio recording first.')
 if(Number(sample.bytes)>25*1024*1024)throw error('Voice sample exceeds 25 MB.')
 if(sample.durationMs!=null&&sample.durationMs<10000)throw error('Voice sample needs at least 10 seconds.')
 const content=await getClipStorage().getObjectBytes(sample.key)
 const form=new FormData()
 form.set('name',label)
 form.set('remove_background_noise','true')
 form.set('files',new Blob([new Uint8Array(content)],{type:sample.mime}),'sample.'+
   (sample.mime.includes('webm')?'webm':sample.mime.includes('wav')?'wav':'mp3'))
 let response:Response
 try{
  response=await fetch('https://api.elevenlabs.io/v1/voices/add',{
   method:'POST',headers:{'xi-api-key':getElevenLabsApiKey()},body:form,
   signal:AbortSignal.timeout(180000),cache:'no-store'})
 }catch{throw new MotionStudioError('INTERNAL','Could not connect to the voice service.',502)}
 if(!response.ok)throw new MotionStudioError('INTERNAL','Could not create voice. Check the sample and try again.',502)
 const created=await response.json() as {voice_id?:string}
 if(!created.voice_id||!voiceIdPattern.test(created.voice_id))throw new MotionStudioError('INTERNAL','Voice service returned an invalid ID.',502)
 const previewUrl=await officialPreview(created.voice_id)
 let record
 try{
  const first=await db().motionStudioVoice.count({where:{workspaceId,userId,isDefault:true}})
  record=await db().motionStudioVoice.create({data:{
   id:'msv_'+randomUUID(),workspaceId,userId,voiceId:created.voice_id,
   name:label,kind:'cloned',sampleUploadId,previewUrl:previewUrl||null,isDefault:first===0
  }})
 }catch{
  await deleteProviderVoice(created.voice_id).catch(()=>{})
  throw new MotionStudioError('INTERNAL','Could not save your voice.',500)
 }
 return {id:record.id,voiceId:record.voiceId,name:record.name,kind:'cloned',isDefault:record.isDefault,previewUrl}
}
async function deleteProviderVoice(id:string){
 const response=await fetch('https://api.elevenlabs.io/v1/voices/'+encodeURIComponent(id),{
  method:'DELETE',headers:{'xi-api-key':getElevenLabsApiKey()},
  signal:AbortSignal.timeout(30000)})
 if(!response.ok&&response.status!==404)throw error('Could not delete voice from provider.',502)
}
export async function deleteClone(workspaceId:string,userId:string,id:string){
 const row=await db().motionStudioVoice.findFirst({where:{id,workspaceId,userId}})
 if(!row||row.kind!=='cloned')throw error('Saved voice not found.',404)
 await deleteProviderVoice(row.voiceId)
 await db().motionStudioVoice.delete({where:{id:row.id}})
}
export async function renameOrDefault(workspaceId:string,userId:string,id:string,raw:unknown){
 const row=await db().motionStudioVoice.findFirst({where:{id,workspaceId,userId}})
 if(!row)throw error('Voice not found.',404)
 const data=raw&&typeof raw==='object'?raw as {name?:unknown;isDefault?:unknown}:{}
 if(typeof data.name==='string'){
  const label=name(data.name);if(label.length<2)throw error('Voice name must be at least 2 characters.')
  await db().motionStudioVoice.update({where:{id},data:{name:label}})
 }
 if(data.isDefault===true)return setDefaultVoice(workspaceId,userId,row.voiceId,row.kind==='cloned'?'cloned':'stock')
 if(data.isDefault===false&&row.isDefault)return setDefaultVoice(workspaceId,userId,null)
 return db().motionStudioVoice.findUnique({where:{id}})
}
