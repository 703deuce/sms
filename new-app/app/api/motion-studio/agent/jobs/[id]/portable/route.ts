import { NextResponse } from 'next/server'
import { requireBotJob } from '@/lib/server/motion-studio/agent-bridge'
import { motionStudioJsonError } from '@/lib/server/motion-studio/http'
import { publishPortableVersion } from '@/lib/server/motion-studio/portable-projects'
type Ctx={params:Promise<{id:string}>}
export async function POST(request:Request,ctx:Ctx) {
  try {
    const {id}=await ctx.params
    const job=await requireBotJob(id,request)
    const raw=await request.json()
    return NextResponse.json(await publishPortableVersion(job.workspaceId,job.projectId,
      {...raw,sourceJobId:id}))
  } catch(e) { return motionStudioJsonError(e) }
}
