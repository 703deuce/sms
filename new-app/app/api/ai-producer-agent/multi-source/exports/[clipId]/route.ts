import { NextResponse } from 'next/server'
import { aiProducerAgentDisabledResponse } from '@/lib/server/ai-producer-agent/api-guard'
import { jsonError } from '@/lib/server/api-error'
import { resolveWorkspaceId } from '@/lib/server/workspace'
import { getPrisma } from '@/lib/server/db'
import { getClipStorageForObjectKey } from '@/lib/storage'

type Params={params:Promise<{clipId:string}>}

/** Resolve a workspace-scoped MP4 from the same existing render pipeline
 * used by the full editor. No guessed object paths or public buckets. */
export async function GET(_request:Request,{params}:Params){
  const disabled=aiProducerAgentDisabledResponse()
  if(disabled)return disabled
  try{
    const workspaceId=await resolveWorkspaceId()
    const {clipId}=await params
    const clip=await getPrisma().clip.findFirst({
      where:{id:clipId,workspaceId,deletedAt:null},
      select:{id:true,project:{select:{settings:true}}},
    })
    if(!clip)return NextResponse.json({error:'not_found'},{status:404})
    const settings=clip.project.settings as Record<string,unknown>|null
    if(!settings?.aiProducerRunId)
      return NextResponse.json({error:'not_ai_producer_output'},{status:400})
    const render=await getPrisma().clipRender.findFirst({
      where:{clipId,workspaceId},orderBy:{createdAt:'desc'},
      select:{id:true,status:true,outputKey:true,error:true,format:true},
    })
    if(!render)return NextResponse.json({data:{status:'not_queued'}})
    const url=render.status==='READY'&&render.outputKey
      ? await (await getClipStorageForObjectKey(render.outputKey))
          .createSignedDownloadUrl(render.outputKey,3600).catch(()=>null)
      : null
    return NextResponse.json({data:{
      id:render.id,status:render.status,error:render.error,
      format:render.format,url,
    }})
  }catch(error){return jsonError(error,500)}
}
