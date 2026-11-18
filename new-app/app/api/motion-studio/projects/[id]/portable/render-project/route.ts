import {NextResponse} from 'next/server'
import {requireMotionStudioCaller} from '@/lib/server/motion-studio/auth'
import {motionStudioJsonError} from '@/lib/server/motion-studio/http'
import {submitDeterministicJob} from '@/lib/server/motion-studio/deterministic-jobs'
type Ctx={params:Promise<{id:string}>}
export async function POST(request:Request,ctx:Ctx){
  try{
    const {id:projectId}=await ctx.params
    const {workspaceId}=await requireMotionStudioCaller(request)
    const job=await submitDeterministicJob(workspaceId,projectId,await request.json())
    return NextResponse.json({id:job.id,status:job.status,versionId:job.versionId},
      {status:job.status==='queued'?202:200})
  }catch(e){return motionStudioJsonError(e)}
}
