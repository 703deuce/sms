import { NextResponse } from 'next/server'
import { resolveWorkspaceId } from '@/lib/server/workspace'
import { adStudioConfig } from '@/lib/server/ad-studio/service'
import { adStudioJsonError } from '@/lib/server/ad-studio/http'

export async function GET() {
  console.info('[ad-studio:api:config] begin')
  try {
    await resolveWorkspaceId()
    const config = adStudioConfig()
    console.info('[ad-studio:api:config] success', { version: config.version })
    return NextResponse.json(config)
  } catch (err) {
    return adStudioJsonError(err)
  }
}
