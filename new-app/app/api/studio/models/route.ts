import { NextResponse } from 'next/server'
import { resolveWorkspaceId } from '../../../../lib/server/workspace'
import { studioJsonError } from '../../../../lib/studio/http'
import { getStudioRegistryDocument } from '../../../../lib/studio/models'

export async function GET() {
  try {
    await resolveWorkspaceId()
    return NextResponse.json(getStudioRegistryDocument())
  } catch (err) {
    return studioJsonError(err)
  }
}
