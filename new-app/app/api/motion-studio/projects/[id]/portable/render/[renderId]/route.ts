import {NextResponse} from 'next/server'
import {requireMotionStudioCaller} from '@/lib/server/motion-studio/auth'
import {motionStudioJsonError} from '@/lib/server/motion-studio/http'
import {getCustomerRenderOutput} from '@/lib/server/motion-studio/render-upload'
import { pollingRoute } from '@/lib/server/db-read-gate'
type Ctx={params:Promise<{id:string;renderId:string}>}
export const GET = pollingRoute(async function GET(request:Request,ctx:Ctx){
  try{
    const {id:projectId,renderId}=await ctx.params
    const {workspaceId}=await requireMotionStudioCaller(request)
    return NextResponse.json(await getCustomerRenderOutput(workspaceId,projectId,renderId))
  }catch(e){return motionStudioJsonError(e)}
})
