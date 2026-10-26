import { NextResponse } from 'next/server'
import { assertDevApiAccess } from '@/lib/server/dev-api-guard'
import { clipUploadLimitsPublic } from '@/lib/server/clips/upload-limits'

export async function GET(request: Request) {
  const denied = assertDevApiAccess(request)
  if (denied) return denied
  return NextResponse.json({ data: clipUploadLimitsPublic() })
}
