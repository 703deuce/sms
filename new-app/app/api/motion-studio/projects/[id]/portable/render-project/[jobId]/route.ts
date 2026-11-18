import {NextResponse} from 'next/server'
import {requireMotionStudioCaller} from '@/lib/server/motion-studio/auth'
import {motionStudioJsonError} from '@/lib/server/motion-studio/http'
import {customerDeterministicJob} from '@/lib/server/motion-studio/deterministic-jobs'
type Ctx={params:Promise<{id:string;jobId:string}>}
export async function GET(request:Request,ctx:Ctx){
  try{
    const {id:projectId,jobId}=await ctx.params
    const {workspaceId}=await requireMotionStudioCaller(request)
    return NextResponse.json({job:await customerDeterministicJob(workspaceId,projectId,jobId)})
  }catch(e){return motionStudioJsonError(e)}
}
