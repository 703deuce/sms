import {NextResponse} from 'next/server'
import {motionStudioJsonError} from '@/lib/server/motion-studio/http'
import {readModalRenderStatus,reportModalRenderStatus} from '@/lib/server/motion-studio/modal-render-status'
type Ctx={params:Promise<{id:string}>}
export async function GET(request:Request,ctx:Ctx){
  try{return NextResponse.json(await readModalRenderStatus((await ctx.params).id,request))}
  catch(error){return motionStudioJsonError(error)}
}
export async function POST(request:Request,ctx:Ctx){
  try{return NextResponse.json(await reportModalRenderStatus((await ctx.params).id,request,await request.json()))}
  catch(error){return motionStudioJsonError(error)}
}
