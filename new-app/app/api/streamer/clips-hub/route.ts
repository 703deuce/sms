import { NextResponse } from 'next/server'
import { jsonError } from '@/lib/server/api-error'
import { resolveWorkspaceId } from '@/lib/server/workspace'
import { listStreamerVodsForWorkspace } from '@/lib/server/streamer/vod-list'
import { listStreamerHubProjectClips } from '@/lib/server/clips/clips'

// Keep signed clip URLs out of the hub's initial server render. The same
// workspace-scoped batch loader and sort order power this deferred response.
export async function GET() {
  const started = Date.now()
  try {
    const workspaceId = await resolveWorkspaceId()
    const vods = await listStreamerVodsForWorkspace(workspaceId)
    const ids = vods
      .filter((vod) => vod.status === 'READY' || vod.status === 'FAILED')
      .map((vod) => vod.projectId)
    const clips = await listStreamerHubProjectClips(workspaceId, ids)
    console.info('[page:timing]', {
      path: '/api/streamer/clips-hub', query: 'deferred_all_vod_clips',
      elapsedMs: Date.now() - started, rows: clips.length, projects: ids.length,
    })
    return NextResponse.json({ data: { clips } })
  } catch (err) {
    console.error('[page:timing]', { path: '/api/streamer/clips-hub', query: 'deferred_clip_failure', elapsedMs: Date.now() - started, error: String(err) })
    return jsonError(err, 500)
  }
}
