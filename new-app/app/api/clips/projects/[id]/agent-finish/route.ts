import { resolveWorkspaceId } from '@/lib/server/workspace'
import { dispatchClipAgentFinish, listClipAgentFinishes, clipAgentError } from '@/lib/server/clips/agent-finish'

export const runtime='nodejs'

export async function GET(_req: Request,ctx:{params:Promise<{id:string}>}) {
  try {
    const {id}=await ctx.params
    return Response.json({jobs:await listClipAgentFinishes(await resolveWorkspaceId(),id)})
  }catch(err){return clipAgentError(err)}
}

/** Starts finishing of existing discovered/scored moments. No new clip scoring. */
export async function POST(request:Request,ctx:{params:Promise<{id:string}>}) {
  try {
    const {id}=await ctx.params
    const workspaceId=await resolveWorkspaceId()
    const input=await request.json() as {clipIds?:unknown}
    if (!Array.isArray(input.clipIds)||!input.clipIds.length||input.clipIds.length>5
      || input.clipIds.some(x=>typeof x!=='string'||!/^clip_[A-Za-z0-9_-]{6,160}$/.test(x))
      || new Set(input.clipIds).size!==input.clipIds.length) {
      return Response.json({error:'Select 1–5 discovered clips.'},{status:400})
    }
    const key=request.headers.get('Idempotency-Key')||'clip-finish-v1'
    const jobs=[]
    for(const clipId of input.clipIds as string[]) {
      jobs.push(await dispatchClipAgentFinish(workspaceId,id,clipId,request,key))
    }
    return Response.json({jobs},{status:202})
  }catch(err){return clipAgentError(err)}
}
