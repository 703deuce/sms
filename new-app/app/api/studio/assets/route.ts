import { NextResponse } from 'next/server'
import { resolveClipsActorUserId } from '../../../../lib/server/clips/clips-auth'
import { resolveWorkspaceId } from '../../../../lib/server/workspace'
import { studioJsonError } from '../../../../lib/studio/http'
import { createStudioAsset } from '../../../../lib/studio/jobs'
import { createDefaultStudioService } from '../../../../lib/studio/runtime'

export async function POST(request: Request) {
  try {
    const workspaceId = await resolveWorkspaceId()
    const userId = await resolveClipsActorUserId(request)
    const form = await request.formData()
    const file = form.get('file') ?? form.get('asset') ?? form.get('image')
    if (!file || typeof file === 'string' || typeof (file as Blob).arrayBuffer !== 'function') {
      return NextResponse.json({ error: 'file is required', code: 'INVALID_PARAMS' }, { status: 400 })
    }
    const blob = file as File
    const bytes = Buffer.from(await blob.arrayBuffer())
    const contentType = blob.type || 'application/octet-stream'
    const asset = await createStudioAsset(createDefaultStudioService(), { workspaceId, userId, bytes, contentType })
    return NextResponse.json({ id: asset.id })
  } catch (err) {
    return studioJsonError(err)
  }
}
