import { NextResponse } from 'next/server'
import { assertDevApiAccess } from '@/lib/server/dev-api-guard'
import { jsonError } from '@/lib/server/api-error'
import { resolveWorkspaceId } from '@/lib/server/workspace'

export const runtime = 'nodejs'
export const maxDuration = 120

export async function PUT(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const denied = assertDevApiAccess(request)
  if (denied) return denied
  try {
    const { id } = await ctx.params
    const offsetRaw = request.headers.get('x-upload-offset') ?? request.headers.get('upload-offset')
    if (!offsetRaw) {
      return NextResponse.json({ error: 'Missing X-Upload-Offset' }, { status: 400 })
    }
    const offset = Number(offsetRaw)
    if (!Number.isFinite(offset) || offset < 0) {
      return NextResponse.json({ error: 'Invalid X-Upload-Offset' }, { status: 400 })
    }
    const workspaceId = await resolveWorkspaceId()
    const body = Buffer.from(await request.arrayBuffer())
    if (!body.length) return NextResponse.json({ error: 'Empty chunk' }, { status: 400 })
    return NextResponse.json(
      {
        error:
          'Server chunk staging is disabled. Uploads go directly to object storage — use Retry to resume from saved parts.',
      },
      { status: 410 },
    )
  } catch (err) {
    return jsonError(err, 400)
  }
}
