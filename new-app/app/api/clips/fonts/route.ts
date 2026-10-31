import { NextResponse } from 'next/server'
import { assertDevApiAccess } from '@/lib/server/dev-api-guard'
import { jsonError } from '@/lib/server/api-error'
import { FontUploadError, listFonts, uploadFont } from '@/lib/server/clips/fonts'
import { FONT_MAX_BYTES } from '@/lib/clips/font-parse'
import { resolveWorkspaceId } from '@/lib/server/workspace'

/**
 * G3b workspace fonts. Manual upload only (no AI, no credits).
 * GET  → { fonts: WorkspaceFont[] }
 * POST multipart `file` (.ttf / .otf ≤ 8 MB) → { font, existing }
 */
export async function GET() {
  try {
    const workspaceId = await resolveWorkspaceId()
    return NextResponse.json({ data: { fonts: await listFonts(workspaceId) } })
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
    if (file.size > FONT_MAX_BYTES) return NextResponse.json({ error: 'Font file is over 8 MB' }, { status: 413 })
    if (!/\.(ttf|otf)$/i.test(file.name)) return NextResponse.json({ error: 'Upload a .ttf or .otf font' }, { status: 400 })
    const out = await uploadFont(workspaceId, file.name, new Uint8Array(await file.arrayBuffer()))
    return NextResponse.json({ data: out })
  } catch (err) {
    if (err instanceof FontUploadError) return NextResponse.json({ error: err.message }, { status: err.status })
    return jsonError(err, 400)
  }
}
