import { NextResponse } from 'next/server'
import { assertDevApiAccess } from '@/lib/server/dev-api-guard'
import { jsonError } from '@/lib/server/api-error'
import { listLuts, LutUploadError, uploadLut } from '@/lib/server/clips/luts'
import { LUT_MAX_BYTES } from '@/lib/clips/luts-shared'
import { resolveWorkspaceId } from '@/lib/server/workspace'

/**
 * G4a workspace LUTs. Manual import only (no AI, no credits).
 * GET  → { luts: WorkspaceLut[] }
 * POST multipart `file` (.cube 3D, ≤ 12 MB) → { lut }
 */
export async function GET() {
  try {
    const workspaceId = await resolveWorkspaceId()
    return NextResponse.json({ data: { luts: await listLuts(workspaceId) } })
  } catch (err) {
    return jsonError(err, 400)
  }
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
