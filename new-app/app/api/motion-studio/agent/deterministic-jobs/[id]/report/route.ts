import {NextResponse} from 'next/server'
import {motionStudioJsonError} from '@/lib/server/motion-studio/http'
import {reportDeterministicJob} from '@/lib/server/motion-studio/deterministic-results'
type Ctx={params:Promise<{id:string}>}
export async function POST(request:Request,ctx:Ctx){
  try{return NextResponse.json(await reportDeterministicJob(request,(await ctx.params).id,await request.json()))}
  catch(e){return motionStudioJsonError(e)}
}
