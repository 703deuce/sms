import { NextResponse } from 'next/server'
import { requireMotionStudioCaller } from '@/lib/server/motion-studio/auth'
import { motionStudioJsonError } from '@/lib/server/motion-studio/http'
import { getPortableProject, commitPortableEdit } from '@/lib/server/motion-studio/portable-projects'
type Ctx={params:Promise<{projectId:string}>}
export async function GET(request:Request,ctx:Ctx) {
  try {
    const {projectId}=await ctx.params
    const {workspaceId}=await requireMotionStudioCaller(request)
    const versionId=new URL(request.url).searchParams.get('versionId')||undefined
    return NextResponse.json(await getPortableProject(workspaceId,projectId,versionId))
  } catch(e) { return motionStudioJsonError(e) }
}
export async function PATCH(request:Request,ctx:Ctx) {
  try {
    const {projectId}=await ctx.params
    const {workspaceId}=await requireMotionStudioCaller(request)
    return NextResponse.json(await commitPortableEdit(workspaceId,projectId,await request.json()))
  } catch(e) { return motionStudioJsonError(e) }
}
