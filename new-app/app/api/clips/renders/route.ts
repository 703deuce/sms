import { NextResponse } from 'next/server'
import { jsonError } from '@/lib/server/api-error'
import { parseExportStatusFilter } from '@/lib/server/clips/export-rows'
import { listClipRenders } from '@/lib/server/clips/renders'
import { resolveWorkspaceId } from '@/lib/server/workspace'

export async function GET(request: Request) {
  try {
    const workspaceId = await resolveWorkspaceId()
    const url = new URL(request.url)
    const filter = parseExportStatusFilter(url.searchParams.get('status') ?? undefined)
    const exports = await listClipRenders(workspaceId, filter)
    return NextResponse.json({ data: { exports } })
  } catch (err) {
    return jsonError(err, 500)
  }
}
