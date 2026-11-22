import { getClipAgentInputs, clipAgentError } from '@/lib/server/clips/agent-finish'
export const runtime = 'nodejs'
export async function GET(request: Request, ctx: {params: Promise<{id: string}>}) {
  try { const {id} = await ctx.params; return Response.json(await getClipAgentInputs(id, request)) }
  catch (error) { return clipAgentError(error) }
}
