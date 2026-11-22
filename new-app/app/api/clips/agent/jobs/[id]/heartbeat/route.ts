import { authorizeClipAgentCallback, clipAgentError } from '@/lib/server/clips/agent-finish'
/** Heartbeat does not mutate the progress or customer-facing stage text. */
export async function POST(request:Request,ctx:{params:Promise<{id:string}>}){
  try{
    const {id}=await ctx.params
    const job=await authorizeClipAgentCallback(id,request)
    if(!['dispatching','dispatched','running'].includes(job.status))
      return Response.json({error:'Job is no longer active.'},{status:409})
    return Response.json({ok:true,leaseExpiresAt:job.leaseExpiresAt?.toISOString()||null})
  }catch(error){return clipAgentError(error)}
}
