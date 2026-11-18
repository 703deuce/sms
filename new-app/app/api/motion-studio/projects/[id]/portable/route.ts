import { NextResponse } from 'next/server'
import { requireMotionStudioCaller } from '@/lib/server/motion-studio/auth'
import { motionStudioJsonError } from '@/lib/server/motion-studio/http'
import { getPortableProject, commitPortableEdit, restorePortableVersion } from '@/lib/server/motion-studio/portable-projects'
type Ctx={params:Promise<{id:string}>}
export async function GET(request:Request,ctx:Ctx) {
  try {
    const {id:projectId}=await ctx.params
    const {workspaceId}=await requireMotionStudioCaller(request)
    const versionId=new URL(request.url).searchParams.get('versionId')||undefined
    return NextResponse.json(await getPortableProject(workspaceId,projectId,versionId))
  } catch(e) { return motionStudioJsonError(e) }
}
export async function PATCH(request:Request,ctx:Ctx) {
  const started=Date.now()
  let outcome='failed'
  try {
    const {id:projectId}=await ctx.params
    const {workspaceId}=await requireMotionStudioCaller(request)
    const body=await request.json()
    const result=await commitPortableEdit(workspaceId,projectId,body)
    outcome='committed'
    return NextResponse.json(result)
  } catch(e) {
    outcome=e instanceof Error ? e.name : 'unknown_error'
    return motionStudioJsonError(e)
  } finally {
    // Timing only; never log the customer's scene content or signed URLs.
    console.info('[motion-studio:portable-save]',{outcome,elapsedMs:Date.now()-started})
  }
}

export async function POST(request:Request,ctx:Ctx){
  try{
    const {id:projectId}=await ctx.params
    const {workspaceId}=await requireMotionStudioCaller(request)
    return NextResponse.json(await restorePortableVersion(workspaceId,projectId,await request.json()))
  }catch(error){return motionStudioJsonError(error)}
}
