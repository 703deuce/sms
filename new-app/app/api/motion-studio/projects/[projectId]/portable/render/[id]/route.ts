import {NextResponse} from 'next/server'
import {requireMotionStudioCaller} from '@/lib/server/motion-studio/auth'
import {motionStudioJsonError} from '@/lib/server/motion-studio/http'
import {getPrisma} from '@/lib/server/db'
type Ctx={params:Promise<{projectId:string;id:string}>}
export async function GET(request:Request,ctx:Ctx){
  try{
    const {projectId,id}=await ctx.params
    const {workspaceId}=await requireMotionStudioCaller(request)
    const requestRow=await getPrisma().motionStudioRenderRequest.findFirst({
      where:{id,workspaceId,projectId},select:{id:true,status:true,resultAssetId:true,error:true,updatedAt:true},
    })
    if(!requestRow)return NextResponse.json({error:'Render request not found'},{status:404})
    return NextResponse.json({render:requestRow})
  }catch(e){return motionStudioJsonError(e)}
}
