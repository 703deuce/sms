import { NextResponse } from 'next/server'
import { z } from 'zod'
import { jsonError } from '@/lib/server/api-error'
import {
  getCompositionShareAccess,
  inviteCollaborator,
  revokeShareLinks,
  updateLinkAccess,
} from '@/lib/server/clips/composition-share'
import { resolveInternalUserId } from '@/lib/server/internal-user'
import { resolveWorkspaceId } from '@/lib/server/workspace'

const patchSchema = z.object({
  linkAccess: z.enum(['INVITE_ONLY', 'LINK_VIEW', 'LINK_COMMENT']).optional(),
  inviteEmail: z.string().email().optional(),
  inviteRole: z.enum(['VIEW', 'COMMENT', 'EDIT']).optional(),
  revokeLinks: z.boolean().optional(),
})

export async function GET(request: Request, ctx: { params: Promise<{ compositionId: string }> }) {
  try {
    const { compositionId } = await ctx.params
    const workspaceId = await resolveWorkspaceId()
    const url = new URL(request.url)
    const baseUrl = `${url.protocol}//${url.host}`
    const access = await getCompositionShareAccess(workspaceId, compositionId, baseUrl)
    if (!access) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ data: access })
  } catch (err) {
    return jsonError(err, 500)
  }
}

export async function PATCH(request: Request, ctx: { params: Promise<{ compositionId: string }> }) {
  try {
    const { compositionId } = await ctx.params
    const workspaceId = await resolveWorkspaceId()
    const userId = await resolveInternalUserId()
    const body = patchSchema.parse(await request.json())
    const url = new URL(request.url)
    const baseUrl = `${url.protocol}//${url.host}`

    if (body.revokeLinks) {
      await revokeShareLinks(workspaceId, compositionId)
    }
    if (body.linkAccess) {
      await updateLinkAccess(workspaceId, compositionId, body.linkAccess, userId)
    }
    if (body.inviteEmail && body.inviteRole) {
      const inv = await inviteCollaborator(workspaceId, compositionId, body.inviteEmail, body.inviteRole)
      if (!inv.ok) {
        const status = inv.code === 'USER_NOT_FOUND' ? 404 : inv.code === 'NOT_IN_WORKSPACE' ? 403 : 404
        return NextResponse.json({ error: inv.code }, { status })
      }
    }

    const access = await getCompositionShareAccess(workspaceId, compositionId, baseUrl)
    if (!access) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ data: access })
  } catch (err) {
    return jsonError(err, 500)
  }
}
