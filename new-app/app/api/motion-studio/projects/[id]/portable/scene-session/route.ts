import {NextResponse} from 'next/server'
import {requireMotionStudioCaller} from '@/lib/server/motion-studio/auth'
import {motionStudioJsonError} from '@/lib/server/motion-studio/http'
import {createSceneSession} from '@/lib/server/motion-studio/scene-host'
type Ctx={params:Promise<{id:string}>}
export async function GET(request:Request,ctx:Ctx){
  try{
    const {id:projectId}=await ctx.params
    const {workspaceId}=await requireMotionStudioCaller(request)
    const query=new URL(request.url).searchParams
    return NextResponse.json(await createSceneSession(
      workspaceId,projectId,query.get('versionId')||'',
      query.get('sceneId')||'',request.url,
    ))
  }catch(e){return motionStudioJsonError(e)}
}
