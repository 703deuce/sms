import { NextResponse } from 'next/server'
import { z } from 'zod'
import { jsonError } from '@/lib/server/api-error'
import {
  getClipExportUserPrefs,
  saveClipExportUserPrefs,
} from '@/lib/server/clips/clip-export-user-prefs'
import { resolveInternalUserId } from '@/lib/server/internal-user'
import { resolveWorkspaceId } from '@/lib/server/workspace'

const patchSchema = z.object({
  removeDeadAir: z.boolean().optional(),
  alsoSrt: z.boolean().optional(),
  exportSfx: z.enum(['off', 'subtle', 'meme']).optional(),
  headlineBarEnabled: z.boolean().optional(),
  platformBadgeEnabled: z.boolean().optional(),
  channelLinkEnabled: z.boolean().optional(),
  profanityCensor: z.boolean().optional(),
  defaultAspect: z.enum(['9:16', '4:5', '1:1', '16:9']).optional(),
  defaultResolution: z.enum(['720p', '1080p']).optional(),
})

export async function GET() {
  try {
    const workspaceId = await resolveWorkspaceId()
    const userId = await resolveInternalUserId()
    const prefs = await getClipExportUserPrefs(workspaceId, userId)
    return NextResponse.json({ data: prefs })
  } catch (err) {
    return jsonError(err, 500)
  }
}

export async function PATCH(request: Request) {
  try {
    const workspaceId = await resolveWorkspaceId()
    const userId = await resolveInternalUserId()
    const patch = patchSchema.parse(await request.json())
    const prefs = await saveClipExportUserPrefs(workspaceId, userId, patch)
    return NextResponse.json({ data: prefs })
  } catch (err) {
    return jsonError(err, 400)
  }
}
