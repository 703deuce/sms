import { NextResponse } from 'next/server'
import { z } from 'zod'
import { StyleProfileSchema } from '@/lib/clips/motion-graphics/contract'
import { createMotionStyle, listMotionStyles } from '@/lib/server/clips/motion-styles'
import { resolveWorkspaceId } from '@/lib/server/workspace'
import { jsonError } from '@/lib/server/api-error'

export async function GET() {
  try {
    const workspaceId = await resolveWorkspaceId()
    return NextResponse.json({ data: await listMotionStyles(workspaceId) })
  } catch (err) { return jsonError(err, 500) }
}
export async function POST(request: Request) {
  try {
    const workspaceId = await resolveWorkspaceId()
    const input = StyleProfileSchema.omit({ id: true }).parse(await request.json())
    const value = await createMotionStyle(workspaceId, input)
    return NextResponse.json({ data: value }, { status: 201 })
  } catch (err) {
    if (err instanceof z.ZodError) return NextResponse.json({ error: 'Invalid style profile' }, { status: 400 })
    return jsonError(err, 500)
  }
}
