import 'server-only'
import {getPrisma} from '@/lib/server/db'
import {enqueueRenderClip} from '@/lib/server/clips/renders'
import {createReadableSignedUrl} from '@/lib/storage'
import type {ClipEditsV2} from '@/lib/clips/edits'
import {toPrismaJson} from '@/lib/server/clips/prisma-json'

const object=(v:unknown):Record<string,unknown>=>v&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,unknown>:{}
const errorText=(raw:unknown)=>typeof raw==='string'?
  raw.replace(/https?:\/\/\S+|Bearer\s+\S+|(?:token|secret|password|key)\s*[:=]\s*\S+/gi,'[redacted]')
    .slice(0,180):null
type ProducerClip={id:string;workspaceId:string;projectId:string;title:string;
  startMs:number;endMs:number;edits:unknown;editsSaveVersion:number;previewKey:string|null;
  aiMeta:unknown}
const db=()=>getPrisma()

/** Each clip creates its own RENDER_CLIP queue row. Calls never serialize renders. */
export async function enqueueProducerServerRender(clip:ProducerClip,producerJobId:string){
  const edits=clip.edits as ClipEditsV2
  const result=await enqueueRenderClip(clip.workspaceId,clip.id,{
    resolution:'1080p',aspect:edits.aspectRatio??'9:16',watermark:false,
    edits,clipStartMs:clip.startMs,clipEndMs:clip.endMs,
    previewKey:null,title:clip.title,producerJobId,
    producerEditsVersion:clip.editsSaveVersion,
  })
  const metadata=object(clip.aiMeta)
  if(result.render.status==='READY'&&result.render.outputKey){
    // A byte-identical older export can be reused without a second paid render.
    await db().clip.update({where:{id:clip.id},data:{
      aiMeta:toPrismaJson({...metadata,agentRenderId:result.render.id,
        agentRenderEditsVersion:clip.editsSaveVersion,
        agentRenderStatus:'done',fullResKey:result.render.outputKey,
        agentFullResEditsVersion:clip.editsSaveVersion}),
    }})
  }else{
    await db().clip.update({where:{id:clip.id},data:{
      aiMeta:toPrismaJson({...metadata,agentRenderId:result.render.id,
        agentRenderEditsVersion:clip.editsSaveVersion,agentRenderStatus:'queued',
        fullResKey:null,agentFullResEditsVersion:null}),
    }})
  }
  return {clipId:clip.id,renderId:result.render.id,
    editsVersion:clip.editsSaveVersion,status:result.render.status==='READY'?'done':'queued'}
}

export async function producerClipRenderStatuses(workspaceId:string,projectId:string,producerJobId:string){
  const clips=await db().clip.findMany({where:{workspaceId,projectId,deletedAt:null},
    select:{id:true,title:true,startMs:true,endMs:true,edits:true,editsSaveVersion:true,
      workspaceId:true,projectId:true,previewKey:true,posterKey:true,aiMeta:true}})
  const selected=clips.filter(c=>object(c.aiMeta).agentClipperRunId===producerJobId)
  const renderIds=selected.map(c=>object(c.aiMeta).agentRenderId).filter((v):v is string=>typeof v==='string')
  const renders=await db().clipRender.findMany({where:{id:{in:renderIds},workspaceId},
    select:{id:true,status:true,outputKey:true,error:true,srtKey:true,editsVersionHash:true}})
  const byId=new Map(renders.map(r=>[r.id,r]))
  const missing=selected.filter(c=>Boolean(object(c.aiMeta).agentServerRender)&&
    !object(c.aiMeta).agentRenderId)
  // Crash recovery only for a clip that never had a render queued. A failed or
  // accepted render is NOT automatically retried.
  await Promise.all(missing.map(c=>enqueueProducerServerRender(c,producerJobId).catch(()=>null)))
  const rows=await Promise.all(selected.map(async c=>{
    const meta=object(c.aiMeta)
    const render=byId.get(String(meta.agentRenderId||''))
    const legacyReady=!meta.agentServerRender&&typeof meta.fullResKey==='string'&&
      Boolean(c.previewKey)
    const stale=Number(meta.agentRenderEditsVersion||0)!==c.editsSaveVersion
    const ready=legacyReady || (render?.status==='READY'&&!stale&&
      Number(meta.agentFullResEditsVersion||0)===c.editsSaveVersion&&Boolean(c.previewKey))
    const status=ready?'done':render?.status==='FAILED'?'failed':
      render?.status==='RENDERING'?'rendering':'queued'
    const sign=async(key:string|null|undefined)=>key?
      createReadableSignedUrl(key,900).catch(()=>null):null
    return {clipId:c.id,renderId:render?.id||null,
      editsVersion:c.editsSaveVersion,
      renderedEditsVersion:ready?c.editsSaveVersion:null,
      status,reason:status==='failed'?errorText(render?.error)||'Clip render failed. Check the editable layers.':null,
      ...(ready?{previewUrl:await sign(c.previewKey),posterUrl:await sign(c.posterKey),
        videoUrl:await sign(render?.outputKey??(typeof meta.fullResKey==='string'?meta.fullResKey:null)),
        srtUrl:await sign(render?.srtKey??(typeof meta.agentSrtKey==='string'?meta.agentSrtKey:null))}:{}),
    }
  }))
  return {clips:rows,summary:{total:rows.length,
    done:rows.filter(x=>x.status==='done').length,
    failed:rows.filter(x=>x.status==='failed').length,
    pending:rows.filter(x=>x.status==='queued'||x.status==='rendering').length}}
}
