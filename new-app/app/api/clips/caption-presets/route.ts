import { NextResponse } from 'next/server'
import { z } from 'zod'
import { jsonError } from '@/lib/server/api-error'
import { createCaptionPreset, listCaptionPresets } from '@/lib/server/clips/caption-presets'
import { resolveWorkspaceId } from '@/lib/server/workspace'

const postSchema = z.object({
  name: z.string().min(1).max(60),
  config: z.record(z.unknown()),
})

export async function GET() {
  try {
    const workspaceId = await resolveWorkspaceId()
    const items = await listCaptionPresets(workspaceId)
    return NextResponse.json({ data: { items } })
  } catch (err) {
    return jsonError(err, 500)
  }
}

export async function POST(request: Request) {
  try {
    const workspaceId = await resolveWorkspaceId()
    const body = postSchema.parse(await request.json())
    const row = await createCaptionPreset(workspaceId, body.name, body.config)
    return NextResponse.json({ data: { preset: row } })
  } catch (err) {
    return jsonError(err, 400)
  }
}
