import { NextResponse } from 'next/server'
import { resolveWorkspaceId } from '@/lib/server/workspace'
import { youtubeVideoErrorResponse } from '@/lib/server/youtube-video/http'
import { productionRunDeps } from '@/lib/server/youtube-video/deps'
import { chooseYoutubeVideoOption } from '@/lib/youtube-video/runs'

/** Explicit owner action only. Normal poll/choice never render QA-rejected edits. */
export async function POST(_request:Request,ctx:{params:Promise<{runId:string}>}){
  try{
    const workspaceId=await resolveWorkspaceId()
    const {runId}=await ctx.params
    const deps=productionRunDeps()
    const record=await deps.store.get(workspaceId,runId)
    if(!record || record.status!=='needs_review'||!record.options?.length){
      return NextResponse.json({error:{code:'review_not_pending',message:'Review approval is not pending.'}},{status:409})
    }
    const view=await chooseYoutubeVideoOption(
      workspaceId,runId,record.options[0]!.id,deps,false,true,
    )
    return NextResponse.json({data:{runId:view.runId,status:view.status}})
  }catch(error){
    return youtubeVideoErrorResponse(error)
  }
}
