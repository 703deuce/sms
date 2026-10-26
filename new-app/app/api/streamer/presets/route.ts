import { NextResponse } from 'next/server'
import { jsonError } from '@/lib/server/api-error'
import { assertDevApiAccess } from '@/lib/server/dev-api-guard'
import { createLayoutPreset, listLayoutPresets, presetCreateSchema } from '@/lib/server/streamer/presets'
import { resolveWorkspaceId } from '@/lib/server/workspace'

export async function GET(request: Request) {
  const denied = assertDevApiAccess(request)
  if (denied) return denied
  try {
    const workspaceId = await resolveWorkspaceId()
    const channelId = new URL(request.url).searchParams.get('channelId') ?? undefined
    const presets = await listLayoutPresets(workspaceId, channelId)
    return NextResponse.json({ data: presets })
  } catch (err) {
    return jsonError(err, 400)
  }
}

export async function POST(request: Request) {
  const denied = assertDevApiAccess(request)
  if (denied) return denied
  try {
    const workspaceId = await resolveWorkspaceId()
    const body = presetCreateSchema.parse(await request.json())
    const preset = await createLayoutPreset(workspaceId, body)
    return NextResponse.json({ data: preset })
  } catch (err) {
    return jsonError(err, 400)
  }
}
