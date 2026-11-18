import {NextResponse} from 'next/server'
import {motionStudioJsonError} from '@/lib/server/motion-studio/http'
import {listEditorAgentTools,applyEditorAgentTool} from '@/lib/server/motion-studio/editor-agent-tools'
type Ctx={params:Promise<{id:string}>}
export async function GET(request:Request,ctx:Ctx){
  try{return NextResponse.json(await listEditorAgentTools((await ctx.params).id,request))}
  catch(e){return motionStudioJsonError(e)}
}
export async function POST(request:Request,ctx:Ctx){
  try{return NextResponse.json(await applyEditorAgentTool((await ctx.params).id,request,await request.json()))}
  catch(e){return motionStudioJsonError(e)}
}
