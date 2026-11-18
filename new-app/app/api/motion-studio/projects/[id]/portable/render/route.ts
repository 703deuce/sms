import { NextResponse } from 'next/server'
import { requireMotionStudioCaller } from '@/lib/server/motion-studio/auth'
import { motionStudioJsonError } from '@/lib/server/motion-studio/http'
import { requestSceneRender } from '@/lib/server/motion-studio/portable-projects'
type Ctx={params:Promise<{id:string}>}
export async function POST(request:Request,ctx:Ctx) {
  try {
    const {id:projectId}=await ctx.params
    const {workspaceId}=await requireMotionStudioCaller(request)
    return NextResponse.json(await requestSceneRender(workspaceId,projectId,await request.json()))
  } catch(e) { return motionStudioJsonError(e) }
}
