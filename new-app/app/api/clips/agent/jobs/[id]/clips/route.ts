import { publishClipAgentResult, clipAgentError } from '@/lib/server/clips/agent-finish'
export const runtime = 'nodejs'
export async function POST(request: Request, ctx: {params: Promise<{id: string}>}) {
  try { const {id} = await ctx.params; return Response.json(await publishClipAgentResult(id, request, await request.json()), {status: 201}) }
  catch (error) { return clipAgentError(error) }
}
