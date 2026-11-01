import { NextResponse } from 'next/server'
import { assertDevApiAccess } from '@/lib/server/dev-api-guard'
import { jsonError } from '@/lib/server/api-error'
import { listLuts, LutUploadError, uploadLut } from '@/lib/server/clips/luts'
import { LUT_MAX_BYTES } from '@/lib/clips/luts-shared'
import { resolveWorkspaceId } from '@/lib/server/workspace'
import { workspaceListResponse } from '@/lib/server/clips/list-route'

/**
 * G4a workspace LUTs. Manual import only (no AI, no credits).
 * GET  → { luts: WorkspaceLut[] }
 * POST multipart `file` (.cube 3D, ≤ 12 MB) → { lut }
 */
// G4c: always per request (never a build-time snapshot of this list).
export const dynamic = 'force-dynamic'

export async function GET() {
  // G4c: no 400 on editor load — see workspaceListResponse.
  return workspaceListResponse('luts', 'luts', async () => listLuts(await resolveWorkspaceId()))
}

export async function POST(request: Request) {
  const denied = assertDevApiAccess(request)
  if (denied) return denied
  try {
    const workspaceId = await resolveWorkspaceId()
    const form = await request.formData()
    const file = form.get('file')
    if (!(file instanceof File)) return NextResponse.json({ error: 'file required' }, { status: 400 })
    if (file.size > LUT_MAX_BYTES) return NextResponse.json({ error: 'LUT file is over 12 MB' }, { status: 413 })
    if (!/\.cube$/i.test(file.name)) return NextResponse.json({ error: 'Import a .cube LUT' }, { status: 400 })
    const lut = await uploadLut(workspaceId, file.name, new Uint8Array(await file.arrayBuffer()))
    return NextResponse.json({ data: { lut } })
  } catch (err) {
    if (err instanceof LutUploadError) return NextResponse.json({ error: err.message }, { status: err.status })
    return jsonError(err, 400)
  }
}
