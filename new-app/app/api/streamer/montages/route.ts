import { NextResponse } from 'next/server'
import { jsonError } from '@/lib/server/api-error'
import { createMontage, listMontages, montageCreateSchema } from '@/lib/server/streamer/montages'
import { resolveWorkspaceId } from '@/lib/server/workspace'

export async function GET(request: Request) {
  try {
    const workspaceId = await resolveWorkspaceId()
    const projectId = new URL(request.url).searchParams.get('projectId')
    if (!projectId) return NextResponse.json({ error: 'projectId required' }, { status: 400 })
    const data = await listMontages(workspaceId, projectId)
    return NextResponse.json({ data })
  } catch (err) {
    return jsonError(err, 500)
  }
}

export async function POST(request: Request) {
  try {
    const workspaceId = await resolveWorkspaceId()
    const input = montageCreateSchema.parse(await request.json())
    const data = await createMontage(workspaceId, input)
    return NextResponse.json({ data })
  } catch (err) {
    return jsonError(err, 500)
  }
}
