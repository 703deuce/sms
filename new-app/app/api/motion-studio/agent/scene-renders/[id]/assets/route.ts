import {NextResponse} from 'next/server'
import {motionStudioJsonError} from '@/lib/server/motion-studio/http'
import {renderUploadAction} from '@/lib/server/motion-studio/render-upload'
type Ctx={params:Promise<{id:string}>}
export async function POST(request:Request,ctx:Ctx){
  try{return NextResponse.json(await renderUploadAction(request,(await ctx.params).id,await request.json()))}
  catch(error){return motionStudioJsonError(error)}
}
