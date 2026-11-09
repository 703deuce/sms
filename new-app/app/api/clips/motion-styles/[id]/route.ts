import { NextResponse } from 'next/server'
import { z } from 'zod'
import { StyleProfileSchema } from '@/lib/clips/motion-graphics/contract'
import { deleteMotionStyle, getMotionStyle, updateMotionStyle } from '@/lib/server/clips/motion-styles'
import { resolveWorkspaceId } from '@/lib/server/workspace'
import { jsonError } from '@/lib/server/api-error'

type Ctx = { params: Promise<{ id: string }> }
export async function GET(_request: Request, ctx: Ctx) {
  try {
    const workspaceId = await resolveWorkspaceId()
    const { id } = await ctx.params
    const item = await getMotionStyle(workspaceId, id)
    return item ? NextResponse.json({ data: item }) : NextResponse.json({ error: 'Not found' }, { status: 404 })
  } catch (err) { return jsonError(err, 500) }
}
export async function PUT(request: Request, ctx: Ctx) {
  try {
    const workspaceId = await resolveWorkspaceId()
    const { id } = await ctx.params
    const input = StyleProfileSchema.omit({ id: true }).parse(await request.json())
    const item = await updateMotionStyle(workspaceId, id, input)
    return item ? NextResponse.json({ data: item }) : NextResponse.json({ error: 'Not found' }, { status: 404 })
  } catch (err) {
    if (err instanceof z.ZodError) return NextResponse.json({ error: 'Invalid style profile' }, { status: 400 })
    return jsonError(err, 500)
  }
}
export async function DELETE(_request: Request, ctx: Ctx) {
  try {
    const workspaceId = await resolveWorkspaceId()
    const { id } = await ctx.params
    const ok = await deleteMotionStyle(workspaceId, id)
    return ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: 'Not found' }, { status: 404 })
  } catch (err) { return jsonError(err, 500) }
}
