import { NextResponse } from 'next/server'
import { z } from 'zod'
import { jsonError } from '@/lib/server/api-error'
import {
  getCompositionShareAccess,
  inviteCollaborator,
  removeCollaborator,
  revokeShareLinks,
  shareBaseUrl,
  updateLinkAccess,
} from '@/lib/server/clips/composition-share'
import { resolveInternalUserId } from '@/lib/server/internal-user'
import { resolveWorkspaceId } from '@/lib/server/workspace'

const patchSchema = z.object({
  linkAccess: z.enum(['INVITE_ONLY', 'LINK_VIEW', 'LINK_COMMENT']).optional(),
  inviteEmail: z.string().email().optional(),
  inviteRole: z.enum(['VIEW', 'COMMENT', 'EDIT']).optional(),
  revokeLinks: z.boolean().optional(),
  removeUserId: z.string().min(1).optional(),
})

export async function GET(request: Request, ctx: { params: Promise<{ compositionId: string }> }) {
  try {
    const { compositionId } = await ctx.params
    const workspaceId = await resolveWorkspaceId()
    const baseUrl = shareBaseUrl()
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
    const baseUrl = shareBaseUrl()

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
    if (body.removeUserId) {
      await removeCollaborator(workspaceId, compositionId, body.removeUserId)
    }

    const access = await getCompositionShareAccess(workspaceId, compositionId, baseUrl)
    if (!access) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ data: access })
  } catch (err) {
    return jsonError(err, 500)
  }
}
