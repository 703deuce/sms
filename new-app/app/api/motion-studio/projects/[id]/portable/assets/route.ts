import {NextResponse} from 'next/server'
import {requireMotionStudioCaller} from '@/lib/server/motion-studio/auth'
import {motionStudioJsonError} from '@/lib/server/motion-studio/http'
import {portableAssetSession} from '@/lib/server/motion-studio/portable-assets'
type Ctx={params:Promise<{id:string}>}
export async function GET(request:Request,ctx:Ctx){
  try{
    const {id:projectId}=await ctx.params
    const {workspaceId}=await requireMotionStudioCaller(request)
    const versionId=new URL(request.url).searchParams.get('versionId')||''
    return NextResponse.json(await portableAssetSession(workspaceId,projectId,versionId))
  }catch(error){return motionStudioJsonError(error)}
}
