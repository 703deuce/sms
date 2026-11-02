import { NextResponse } from 'next/server'
import { jsonError } from '@/lib/server/api-error'
import { clipperLog } from '@/lib/server/clips/clipper-log'
import { retranscribeClipProject } from '@/lib/server/clips/retranscribe-project'
import { resolveWorkspaceId } from '@/lib/server/workspace'

export async function POST(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id: projectId } = await ctx.params
    const workspaceId = await resolveWorkspaceId()
    const result = await retranscribeClipProject(workspaceId, projectId)
    if (!result) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if ('error' in result) {
      const msg =
        result.error === 'no_upload'
          ? 'This project has no upload to transcribe.'
          : result.error === 'busy'
            ? 'Wait until processing finishes before re-transcribing.'
            : 'Re-transcribe is not available for this project.'
      return NextResponse.json({ error: msg }, { status: 409 })
    }
    clipperLog('retranscribe', 'project_requeued', { projectId, workspaceId, jobId: result.jobId })
    return NextResponse.json({ data: { ok: true, jobId: result.jobId, status: result.status } })
  } catch (err) {
    return jsonError(err, 500)
  }
}
