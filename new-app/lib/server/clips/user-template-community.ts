import 'server-only'

import { createId } from '@/lib/supabase/id'
import { getPrisma } from '@/lib/server/db'
import { getAuthenticatedUser } from '@/lib/server/auth/session'
import { toPrismaJson } from '@/lib/server/clips/prisma-json'
import {
  getPrivateUserTemplate,
  usePrivateUserTemplate,
} from '@/lib/server/clips/user-templates'
import type {
  UserTemplateAssetManifestV1,
  UserTemplateDefinitionV1,
} from '@/lib/clips/user-templates/contract'

const CATEGORIES=new Set(['gaming','podcast','social','business','education','lifestyle','other'])
const TAG=/^[a-z0-9][a-z0-9 _-]{0,31}$/i
const EXTERNAL=/\b(?:https?:\/\/|javascript:|data:|blob:)/i
const EXECUTABLE=/\.(?:exe|dll|dmg|pkg|msi|bat|cmd|ps1|sh|app|scr|jar)(?:\b|$)/i

function object(v:unknown):v is Record<string,unknown>{return Boolean(v)&&typeof v==='object'&&!Array.isArray(v)}
function parsePublicBundle(raw:unknown):{definition:UserTemplateDefinitionV1;manifest:UserTemplateAssetManifestV1}{
  if(!object(raw)||raw.v!==1||!object(raw.definition)||!object(raw.manifest))
    throw new Error('Published template definition is corrupt')
  return {definition:raw.definition as unknown as UserTemplateDefinitionV1,
    manifest:raw.manifest as unknown as UserTemplateAssetManifestV1}
}
function publicText(v:string,max:number){
  const out=v.replace(/[\u0000-\u001f\u007f]/g,' ').replace(/\s+/g,' ').trim().slice(0,max)
  if(!out) throw new Error('Public text is required')
  if(EXTERNAL.test(out)) throw new Error('External URLs are not allowed in public template metadata')
  if(EXECUTABLE.test(out)) throw new Error('Executable/file payload references are not allowed')
  return out
}
function recursiveUnsafe(v:unknown):boolean{
  if(typeof v==='string') return EXTERNAL.test(v)||EXecutableLike(v)
  if(Array.isArray(v)) return v.some(recursiveUnsafe)
  if(object(v)) return Object.entries(v).some(([k,x])=>/url|token|signature|credential|storagekey|sourceprojectid/i.test(k)||recursiveUnsafe(x))
  return false
}
function EXecutableLike(s:string){return EXECUTABLE.test(s)}
function flagsFor(...values:string[]):string[]{
  const joined=values.join(' ').toLowerCase()
  const flags:string[]=[]
  if(/\b(?:hate|kill|terror|porn|stolen|pirated|copyrighted)\b/.test(joined)) flags.push('manual_content_review')
  if(joined.length>1800) flags.push('long_metadata')
  return flags
}
async function rate(scope:string,actorKey:string,limit:number,windowMs:number){
  const now=Date.now()
  const windowStart=new Date(Math.floor(now/windowMs)*windowMs)
  const row=await getPrisma().clipTemplateRateLimit.upsert({
    where:{scope_actorKey_windowStart:{scope,actorKey,windowStart}},
    create:{id:createId('utrate'),scope,actorKey,windowStart,count:1},
    update:{count:{increment:1}},
  })
  if(row.count>limit) throw new Error('Rate limit exceeded; try again after the current review window')
}
export async function requireTemplateModerator(req:Request):Promise<string>{
  const auth=await getAuthenticatedUser(req)
  if(!auth?.id) throw new Error('Authentication required')
  const user=await getPrisma().user.findUnique({where:{id:auth.id},select:{id:true,isPlatformAdmin:true}})
  if(!user?.isPlatformAdmin) throw new Error('Moderator permission required')
  return user.id
}

export async function submitUserTemplateForReview(workspaceId:string,actorUserId:string,templateId:string,input:{
  revision?:number
  title:string
  description:string
  category:string
  tags:string[]
  creatorName:string
  licenseTerms:string
  ownsOrLicensed:boolean
  recognizablePeoplePermission:boolean
  authorReviewedExampleText:boolean
}){
  await rate('template_submit',actorUserId,5,60*60*1000)
  const priorAbuse=await getPrisma().clipTemplateModerationEvent.count({where:{
    action:{in:['rejected','hidden','takedown']},
    createdAt:{gte:new Date(Date.now()-30*24*60*60*1000)},
    publication:{creatorUserId:actorUserId},
  }})
  if(priorAbuse>=3) throw new Error('Community submission is temporarily disabled after repeated moderation actions')
  if(!input.ownsOrLicensed||!input.recognizablePeoplePermission||!input.authorReviewedExampleText)
    throw new Error('Confirm ownership/licensing, people permissions, and the public example text before submission')
  if(!CATEGORIES.has(input.category)) throw new Error('Invalid community category')
  const tags=[...new Set(input.tags.map(t=>t.trim()).filter(Boolean))]
  if(tags.length>8||tags.some(t=>!TAG.test(t))) throw new Error('Use up to 8 short plain-text tags')
  const loaded=await getPrivateUserTemplate(workspaceId,templateId,input.revision)
  if(loaded.revision.createdById!==actorUserId&&loaded.id!==templateId)
    throw new Error('Template revision is not available')
  const definition=loaded.revision.definition as unknown as UserTemplateDefinitionV1
  const manifest=loaded.revision.assetManifest as unknown as UserTemplateAssetManifestV1
  if(!object(definition)||definition.v!==1||!object(manifest)||manifest.v!==1)
    throw new Error('Template revision is corrupt')
  if(manifest.decorative.length)
    throw new Error('Public templates cannot include private decorative uploads, generated assets, music, or uploaded fonts. Make them slots or remove them first.')
  if(manifest.musicPolicy==='keep')
    throw new Error('A private soundtrack cannot be redistributed. Make music replaceable or mute it.')
  if(!definition.slots.some(s=>s.target.kind==='main'))
    throw new Error('Public templates must make the main source replaceable')
  if(recursiveUnsafe(definition))
    throw new Error('Public definition contains private IDs/URLs/credentials; remove that dependency before submitting')
  const publicTitle=publicText(input.title,120)
  const publicDescription=input.description.trim()?publicText(input.description,1000):''
  const creatorName=publicText(input.creatorName,80)
  const licenseTerms=publicText(input.licenseTerms,600)
  const moderationFlags=flagsFor(publicTitle,publicDescription,tags.join(' '))
  const durationMs=Math.max(1,definition.snapshot.clipEndMs-definition.snapshot.clipStartMs)
  const existing=await getPrisma().clipTemplatePublication.findFirst({where:{
    templateId,revisionId:loaded.revision.id,state:'submitted',
  },select:{id:true}})
  if(existing) throw new Error('This revision is already awaiting review')
  const publicationId=createId('utpub')
  const bundle={v:1,definition,manifest}
  const preview={
    v:1,kind:'sanitized-demo-placeholders',
    aspect:definition.snapshot.aspect,durationMs,
    range:definition.previewRange,
    slots:definition.slots.map(s=>({id:s.id,ordinal:s.ordinal,label:s.label,media:s.media})),
    text:definition.textFields.map(f=>({id:f.id,exampleText:f.exampleText})),
  }
  const pub=await getPrisma().$transaction(async tx=>{
    const row=await tx.clipTemplatePublication.create({data:{
      id:publicationId,templateId,revisionId:loaded.revision.id,creatorUserId:actorUserId,creatorName,
      state:'submitted',title:publicTitle,description:publicDescription,category:input.category,tags,
      aspect:definition.snapshot.aspect,clipCount:definition.slots.length,durationMs,licenseTerms,
      publicDefinition:toPrismaJson(bundle),publicPreview:toPrismaJson(preview),
      rightsAttestation:toPrismaJson({v:1,ownsOrLicensed:true,recognizablePeoplePermission:true,
        authorReviewedExampleText:true,submittedAt:new Date().toISOString()}),
      moderationFlags:toPrismaJson(moderationFlags),submittedAt:new Date(),
    }})
    await tx.clipTemplateModerationEvent.create({data:{id:createId('utaudit'),publicationId,
      actorUserId,actorRole:'creator',action:'submitted',metadata:toPrismaJson({revision:loaded.revision.revision})}})
    return row
  })
  return {id:pub.id,state:pub.state,moderationFlags}
}

export async function searchCommunityTemplates(input:{
  q?:string;category?:string;tag?:string;aspect?:string;minClips?:number;maxClips?:number;
  minDurationMs?:number;maxDurationMs?:number;page?:number
}){
  const page=Math.max(1,Math.min(10000,input.page??1)),take=24
  const where:any={state:'published',hiddenAt:null,withdrawnAt:null}
  if(input.q?.trim()) where.OR=[
    {title:{contains:input.q.trim().slice(0,120),mode:'insensitive'}},
    {description:{contains:input.q.trim().slice(0,120),mode:'insensitive'}},
  ]
  if(input.category&&CATEGORIES.has(input.category)) where.category=input.category
  if(input.tag&&TAG.test(input.tag)) where.tags={has:input.tag}
  if(input.aspect&&input.aspect.length<=20) where.aspect=input.aspect
  if(input.minClips!=null||input.maxClips!=null) where.clipCount={
    ...(input.minClips!=null?{gte:Math.max(1,input.minClips)}:{}),
    ...(input.maxClips!=null?{lte:Math.min(120,input.maxClips)}:{}),
  }
  if(input.minDurationMs!=null||input.maxDurationMs!=null) where.durationMs={
    ...(input.minDurationMs!=null?{gte:Math.max(1,input.minDurationMs)}:{}),
    ...(input.maxDurationMs!=null?{lte:Math.min(6*60*60*1000,input.maxDurationMs)}:{}),
  }
  const [total,rows]=await Promise.all([
    getPrisma().clipTemplatePublication.count({where}),
    getPrisma().clipTemplatePublication.findMany({where,orderBy:[{publishedAt:'desc'},{id:'asc'}],
      take,skip:(page-1)*take,select:{id:true,title:true,description:true,creatorName:true,category:true,tags:true,
        aspect:true,clipCount:true,durationMs:true,licenseTerms:true,publicPreview:true,publishedAt:true}}),
  ])
  return {items:rows,total,page,pages:Math.max(1,Math.ceil(total/take))}
}

export async function getPublishedCommunityTemplate(publicationId:string){
  const row=await getPrisma().clipTemplatePublication.findFirst({where:{
    id:publicationId,state:'published',hiddenAt:null,withdrawnAt:null,
  },select:{id:true,title:true,description:true,creatorName:true,category:true,tags:true,aspect:true,clipCount:true,
    durationMs:true,licenseTerms:true,publicDefinition:true,publicPreview:true,publishedAt:true}})
  if(!row) throw new Error('Community template not found')
  return row
}

export async function usePublishedCommunityTemplate(workspaceId:string,actorUserId:string,publicationId:string,input:{
  fills:Record<string,string>;text?:Record<string,string>;musicUploadId?:string
}){
  await rate('template_public_use',actorUserId,30,60*60*1000)
  const pub=await getPublishedCommunityTemplate(publicationId)
  const bundle=parsePublicBundle(pub.publicDefinition)
  if(bundle.manifest.decorative.length) throw new Error('Published definition is not sanitized')
  const templateId=createId('utpl'),revisionId=createId('utrev')
  const fingerprint='public:'+publicationId
  await getPrisma().$transaction(async tx=>{
    await tx.clipUserTemplate.create({data:{id:templateId,workspaceId,createdById:actorUserId,
      title:(pub.title+' copy').slice(0,120),description:pub.description,visibility:'private',currentRevision:1}})
    await tx.clipUserTemplateRevision.create({data:{id:revisionId,templateId,workspaceId,revision:1,
      definition:toPrismaJson(bundle.definition),assetManifest:toPrismaJson(bundle.manifest),
      sourceFingerprint:fingerprint,createdById:actorUserId}})
  })
  try{
    return await usePrivateUserTemplate(workspaceId,actorUserId,templateId,{
      revision:1,fills:input.fills,text:input.text,musicUploadId:input.musicUploadId,
    })
  }catch(error){
    await getPrisma().clipUserTemplate.update({where:{id:templateId},data:{deletedAt:new Date()}}).catch(()=>{})
    throw error
  }
}

export async function reportCommunityTemplate(workspaceId:string,actorUserId:string,publicationId:string,input:{
  reason:'abuse'|'privacy'|'copyright'|'spam';details?:string
}){
  await rate('template_report',actorUserId,10,60*60*1000)
  await getPublishedCommunityTemplate(publicationId)
  const details=(input.details??'').replace(/[\u0000-\u001f\u007f]/g,' ').trim().slice(0,1200)
  if(EXTERNAL.test(details)) throw new Error('External URLs are not accepted in report details')
  const duplicate=await getPrisma().clipTemplateReport.findFirst({where:{
    publicationId,reporterUserId:actorUserId,status:'open',
  },select:{id:true}})
  if(duplicate) throw new Error('You already have an open report for this template')
  return getPrisma().clipTemplateReport.create({data:{id:createId('utreport'),publicationId,
    reporterUserId:actorUserId,workspaceId,reason:input.reason,details:details||null}})
}

export async function withdrawCommunityPublication(workspaceId:string,actorUserId:string,publicationId:string){
  const pub=await getPrisma().clipTemplatePublication.findFirst({where:{id:publicationId,
    template:{workspaceId,deletedAt:null}},select:{id:true,creatorUserId:true,state:true}})
  if(!pub||pub.creatorUserId!==actorUserId) throw new Error('Publication not found')
  if(!['submitted','published','rejected'].includes(pub.state)) throw new Error('Publication cannot be withdrawn')
  return getPrisma().$transaction(async tx=>{
    const row=await tx.clipTemplatePublication.update({where:{id:publicationId},data:{
      state:'withdrawn',withdrawnAt:new Date(),
    }})
    await tx.clipTemplateModerationEvent.create({data:{id:createId('utaudit'),publicationId,
      actorUserId,actorRole:'creator',action:'withdrawn'}})
    return row
  })
}

export async function listModerationQueue(){
  return getPrisma().clipTemplatePublication.findMany({where:{state:'submitted'},orderBy:{submittedAt:'asc'},
    take:100,select:{id:true,title:true,description:true,creatorName:true,creatorUserId:true,category:true,tags:true,
      aspect:true,clipCount:true,durationMs:true,licenseTerms:true,publicDefinition:true,publicPreview:true,
      rightsAttestation:true,moderationFlags:true,submittedAt:true,
      reports:{where:{status:'open'},select:{id:true,reason:true,details:true,createdAt:true}}}})
}

export async function moderateCommunityTemplate(moderatorUserId:string,publicationId:string,input:{
  action:'approve'|'reject'|'hide'|'unpublish'|'restore';reason?:string
}){
  const pub=await getPrisma().clipTemplatePublication.findUnique({where:{id:publicationId},
    select:{id:true,state:true,creatorUserId:true,publicDefinition:true}})
  if(!pub) throw new Error('Publication not found')
  if(pub.creatorUserId===moderatorUserId) throw new Error('Creators cannot approve or moderate their own publication')
  const reason=(input.reason??'').replace(/[\u0000-\u001f\u007f]/g,' ').trim().slice(0,1000)
  if(input.action!=='approve'&&input.action!=='restore'&&!reason) throw new Error('A moderation reason is required')
  const now=new Date()
  let data:any={}
  let action=input.action
  if(input.action==='approve'){
    if(pub.state!=='submitted') throw new Error('Only submitted templates can be approved')
    const bundle=parsePublicBundle(pub.publicDefinition)
    if(bundle.manifest.decorative.length||recursiveUnsafe(bundle))
      throw new Error('Sanitization gate failed')
    data={state:'published',approvedAt:now,publishedAt:now,rejectedAt:null,hiddenAt:null,withdrawnAt:null}
    action='approved'
  }else if(input.action==='reject'){
    if(pub.state!=='submitted') throw new Error('Only submitted templates can be rejected')
    data={state:'rejected',rejectedAt:now}
    action='rejected'
  }else if(input.action==='hide'||input.action==='unpublish'){
    if(pub.state!=='published') throw new Error('Only published templates can be hidden')
    data={state:'hidden',hiddenAt:now}
    action=input.action==='hide'?'hidden':'unpublished'
  }else{
    if(pub.state!=='hidden') throw new Error('Only hidden templates can be restored')
    data={state:'published',hiddenAt:null,publishedAt:pub.state==='hidden'?now:undefined}
    action='restored'
  }
  return getPrisma().$transaction(async tx=>{
    const row=await tx.clipTemplatePublication.update({where:{id:publicationId},data})
    await tx.clipTemplateModerationEvent.create({data:{id:createId('utaudit'),publicationId,
      actorUserId:moderatorUserId,actorRole:'moderator',action,reason:reason||null}})
    if(['hidden','unpublished'].includes(action))
      await tx.clipTemplateReport.updateMany({where:{publicationId,status:'open'},data:{status:'reviewed'}})
    return row
  })
}
