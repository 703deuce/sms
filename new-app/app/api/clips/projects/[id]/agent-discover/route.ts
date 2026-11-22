import { assertDevApiAccess } from '@/lib/server/dev-api-guard'
import { resolveWorkspaceId } from '@/lib/server/workspace'
import { dispatchClipAgentDiscover, listClipAgentFinishes, clipAgentError } from '@/lib/server/clips/agent-finish'

export const runtime='nodejs'

export async function GET(_request:Request,context:{params:Promise<{id:string}>}) {
  try {
    const {id}=await context.params
    const jobs=await listClipAgentFinishes(await resolveWorkspaceId(),id)
    return Response.json({job:jobs.find(j=>j.clipId==='project:'+id)||null})
  }catch(err){return clipAgentError(err)}
}

/** Runs one unified Grok director on the uploaded project to find and finish clips. */
export async function POST(request:Request,context:{params:Promise<{id:string}>}) {
  const denied=assertDevApiAccess(request)
  if(denied) return denied
  try {
    const {id}=await context.params
    const body=await request.json().catch(()=>( {} )) as {maxClips?:unknown}
    const maxClips=body.maxClips===undefined?5:Number(body.maxClips)
    if(!Number.isInteger(maxClips)||maxClips<1||maxClips>15)
      return Response.json({error:'Choose 1–15 finished highlights.'},{status:400})
    const job=await dispatchClipAgentDiscover(await resolveWorkspaceId(),id,request,
      request.headers.get('Idempotency-Key')||'agent-discovery-v1',maxClips)
    return Response.json({job},{status:202})
  }catch(err){return clipAgentError(err)}
}
