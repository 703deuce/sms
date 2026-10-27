import { NextResponse } from 'next/server'
import { z } from 'zod'
import { jsonError } from '@/lib/server/api-error'
import { getEditorPreferences, saveEditorPreferences } from '@/lib/server/clips/editor-preferences'
import { resolveInternalUserId } from '@/lib/server/internal-user'
import { resolveWorkspaceId } from '@/lib/server/workspace'

const patchSchema = z.object({
  automaticVolumeLevels: z.boolean().optional(),
  showVolumeDb: z.boolean().optional(),
  useRoomToneOnGaps: z.boolean().optional(),
  applySmartTransitions: z.boolean().optional(),
  defaultCaptionStyleId: z.string().optional(),
  defaultClipAspect: z.enum(['9:16', '1:1', '4:5', '16:9']).optional(),
  limitPreview1080: z.boolean().optional(),
  theme: z.enum(['dark', 'light', 'system']).optional(),
  showWordlessMediaInScript: z.boolean().optional(),
})

export async function GET() {
  try {
    const workspaceId = await resolveWorkspaceId()
    const userId = await resolveInternalUserId()
    const prefs = await getEditorPreferences(workspaceId, userId)
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
    const prefs = await saveEditorPreferences(workspaceId, userId, patch)
    return NextResponse.json({ data: prefs })
  } catch (err) {
    return jsonError(err, 500)
  }
}
