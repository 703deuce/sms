import {getClipAgentRenders,reviseClipAgentRender,clipAgentError} from '@/lib/server/clips/agent-finish'
export const runtime='nodejs'
export async function GET(request:Request,ctx:{params:Promise<{id:string}>}){
  try{return Response.json(await getClipAgentRenders((await ctx.params).id,request))}
  catch(error){return clipAgentError(error)}
}
export async function POST(request:Request,ctx:{params:Promise<{id:string}>}){
  try{return Response.json(await reviseClipAgentRender((await ctx.params).id,request,await request.json()))}
  catch(error){return clipAgentError(error)}
}
