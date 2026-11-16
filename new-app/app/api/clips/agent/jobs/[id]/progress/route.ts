import { updateClipAgentProgress, clipAgentError } from '@/lib/server/clips/agent-finish'
export async function POST(request:Request,ctx:{params:Promise<{id:string}>}) {
  try {const {id}=await ctx.params;return Response.json({job:await updateClipAgentProgress(id,request,await request.json())})}
  catch(err){return clipAgentError(err)}
}
