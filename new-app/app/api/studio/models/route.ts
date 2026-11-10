import { NextResponse } from 'next/server'
import { resolveWorkspaceId } from '../../../../lib/server/workspace'
import { studioJsonError } from '../../../../lib/studio/http'
import { getStudioRegistryDocument } from '../../../../lib/studio/models'

export async function GET(request: Request) {
  try {
    await resolveWorkspaceId()
    const mode = new URL(request.url).searchParams.get('mode')
    return NextResponse.json(getStudioRegistryDocument(mode === 'source_video_edit' ? { mode: 'source_video_edit' } : undefined))
  } catch (err) {
    return studioJsonError(err)
  }
}
