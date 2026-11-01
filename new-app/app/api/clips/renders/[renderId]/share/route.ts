import { NextResponse } from 'next/server'
import { z } from 'zod'
import { jsonError } from '@/lib/server/api-error'
import { resolveClipsActorUserId } from '@/lib/server/clips/clips-auth'
import {
  createRenderShareLink,
  getRenderShareForWorkspace,
  revokeRenderShareLink,
  updateRenderShareLink,
} from '@/lib/server/clips/render-share'
import { resolveWorkspaceId } from '@/lib/server/workspace'

const patchSchema = z.object({
  allowDownload: z.boolean().optional(),
  expiresAt: z.string().datetime().nullable().optional(),
})

const postSchema = z.object({
  allowDownload: z.boolean().optional(),
  expiresAt: z.string().datetime().nullable().optional(),
})

export async function GET(_request: Request, ctx: { params: Promise<{ renderId: string }> }) {
  try {
    const { renderId } = await ctx.params
    const workspaceId = await resolveWorkspaceId()
    const link = await getRenderShareForWorkspace(workspaceId, renderId)
    if (!link) return NextResponse.json({ data: null })
    return NextResponse.json({ data: link })
  } catch (err) {
    return jsonError(err, 500)
  }
}

export async function POST(request: Request, ctx: { params: Promise<{ renderId: string }> }) {
  try {
    const { renderId } = await ctx.params
    const workspaceId = await resolveWorkspaceId()
    const userId = await resolveClipsActorUserId(request)
    const raw = await request.text()
    const body = postSchema.parse(raw ? JSON.parse(raw) : {})
    const created = await createRenderShareLink(workspaceId, renderId, userId, {
      allowDownload: body.allowDownload,
      expiresAt: body.expiresAt ? new Date(body.expiresAt) : body.expiresAt === null ? null : undefined,
    })
    if (!created) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({
      data: {
        ...created.link,
        accessToken: created.accessToken,
      },
    })
  } catch (err) {
    return jsonError(err, 400)
  }
}

export async function PATCH(request: Request, ctx: { params: Promise<{ renderId: string }> }) {
  try {
    const { renderId } = await ctx.params
    const workspaceId = await resolveWorkspaceId()
    await resolveClipsActorUserId(request)
    const body = patchSchema.parse(await request.json())
    const updated = await updateRenderShareLink(workspaceId, renderId, {
      allowDownload: body.allowDownload,
      expiresAt:
        body.expiresAt !== undefined
          ? body.expiresAt
            ? new Date(body.expiresAt)
            : null
          : undefined,
    })
    if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ data: updated })
  } catch (err) {
    return jsonError(err, 400)
  }
}

export async function DELETE(request: Request, ctx: { params: Promise<{ renderId: string }> }) {
  try {
    const { renderId } = await ctx.params
    const workspaceId = await resolveWorkspaceId()
    await resolveClipsActorUserId(request)
    const ok = await revokeRenderShareLink(workspaceId, renderId)
    if (!ok) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ data: { ok: true } })
  } catch (err) {
    return jsonError(err, 500)
  }
}
