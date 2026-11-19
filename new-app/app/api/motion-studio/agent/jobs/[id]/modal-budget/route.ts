import {NextResponse} from 'next/server'
import {motionStudioJsonError} from '@/lib/server/motion-studio/http'
import {requireModalBudget} from '@/lib/server/motion-studio/modal-render-status'
type Ctx={params:Promise<{id:string}>}
export async function GET(request:Request,ctx:Ctx){
  try{
    const u=new URL(request.url)
    const raw=u.searchParams.get('estimateUsdMicros')
    const estimate=raw===null?0:Number(raw)
    return NextResponse.json(await requireModalBudget((await ctx.params).id,request,estimate),
      {headers:{'Cache-Control':'private, no-store'}})
  }catch(error){return motionStudioJsonError(error)}
}
