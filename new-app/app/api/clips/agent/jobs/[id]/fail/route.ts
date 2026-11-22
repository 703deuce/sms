import { failClipAgentJob, clipAgentError } from '@/lib/server/clips/agent-finish'
export const runtime = 'nodejs'
export async function POST(request: Request, ctx: {params: Promise<{id: string}>}) {
  try { const {id} = await ctx.params; return Response.json({job: await failClipAgentJob(id, request, await request.json())}) }
  catch (error) { return clipAgentError(error) }
}
