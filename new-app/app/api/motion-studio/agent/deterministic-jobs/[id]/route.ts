import {NextResponse} from 'next/server'
import {motionStudioJsonError} from '@/lib/server/motion-studio/http'
import {getWorkerDeterministicJob} from '@/lib/server/motion-studio/deterministic-jobs'
type Ctx={params:Promise<{id:string}>}
export async function GET(request:Request,ctx:Ctx){
  try{return NextResponse.json({job:await getWorkerDeterministicJob(request,(await ctx.params).id)})}
  catch(e){return motionStudioJsonError(e)}
}
