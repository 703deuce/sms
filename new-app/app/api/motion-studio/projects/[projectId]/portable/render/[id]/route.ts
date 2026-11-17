import {NextResponse} from 'next/server'
import {requireMotionStudioCaller} from '@/lib/server/motion-studio/auth'
import {motionStudioJsonError} from '@/lib/server/motion-studio/http'
import {getCustomerRenderOutput} from '@/lib/server/motion-studio/render-upload'
type Ctx={params:Promise<{projectId:string;id:string}>}
export async function GET(request:Request,ctx:Ctx){
  try{
    const {projectId,id}=await ctx.params
    const {workspaceId}=await requireMotionStudioCaller(request)
    return NextResponse.json(await getCustomerRenderOutput(workspaceId,projectId,id))
  }catch(e){return motionStudioJsonError(e)}
}
