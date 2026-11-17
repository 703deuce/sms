import {NextResponse} from 'next/server'
import {motionStudioJsonError} from '@/lib/server/motion-studio/http'
import {getWorkerSceneRender,reportSceneRender} from '@/lib/server/motion-studio/render-coordinator'
type Ctx={params:Promise<{id:string}>}
export async function GET(request:Request,ctx:Ctx){
  try{return NextResponse.json(await getWorkerSceneRender(request,(await ctx.params).id))}
  catch(e){return motionStudioJsonError(e)}
}
export async function POST(request:Request,ctx:Ctx){
  try{return NextResponse.json(await reportSceneRender(request,(await ctx.params).id,await request.json()))}
  catch(e){return motionStudioJsonError(e)}
}
