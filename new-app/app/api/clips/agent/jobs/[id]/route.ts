import { authorizeClipAgentCallback, getClipAgentAssignment, clipAgentError } from '@/lib/server/clips/agent-finish'
export async function GET(request:Request,ctx:{params:Promise<{id:string}>}) {
  try {const {id}=await ctx.params;return Response.json(await getClipAgentAssignment(id,request))}
  catch(err){return clipAgentError(err)}
}
