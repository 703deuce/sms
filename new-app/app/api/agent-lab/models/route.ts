import { agentLabErrorResponse } from '@/lib/server/agent-lab'
import { listLabModels } from '@/lib/server/agent-lab-models'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    return Response.json(await listLabModels())
  } catch (err) {
    return agentLabErrorResponse(err)
  }
}
