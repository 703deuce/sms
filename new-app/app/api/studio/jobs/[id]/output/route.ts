import { resolveWorkspaceId } from '../../../../../../lib/server/workspace'
import { getClipStorage, getClipStorageForObjectKey } from '../../../../../../lib/storage'
import { createCachedSignedDownloadUrl } from '../../../../../../lib/storage/signed-download-cache'
import { studioJsonError } from '../../../../../../lib/studio/http'
import { getStudioJobForOutput } from '../../../../../../lib/studio/jobs'
import { createDefaultStudioService } from '../../../../../../lib/studio/runtime'

export async function GET(request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params
    const workspaceId = await resolveWorkspaceId()
    const job = await getStudioJobForOutput(createDefaultStudioService(), workspaceId, id)
    const key = job.outputStorageKey
    if (!key) {
      return studioJsonError(new Error('Job output is not ready'))
    }
    const storage = job.outputStorageDriver
      ? getClipStorage(job.outputStorageDriver)
      : await getClipStorageForObjectKey(key)
    const signed = await createCachedSignedDownloadUrl(storage, key, {
      versionHint: job.updatedAt.toISOString(),
    })
    const range = request.headers.get('range')
    const upstream = await fetch(signed, {
      headers: range ? { Range: range } : {},
      cache: 'no-store',
      signal: request.signal,
    })
    if (!upstream.ok || !upstream.body) {
      return new Response(JSON.stringify({ error: 'Media unavailable', code: 'STORAGE_ERROR' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    const download = new URL(request.url).searchParams.get('download')
    const headers = new Headers({
      'Content-Type': upstream.headers.get('content-type') ?? job.outputContentType ?? 'application/octet-stream',
      'Cache-Control': 'private, no-store',
      'Accept-Ranges': upstream.headers.get('accept-ranges') ?? 'bytes',
      'X-Content-Type-Options': 'nosniff',
    })
    if (download) {
      const ext = (job.outputContentType || '').includes('png')
        ? 'png'
        : (job.outputContentType || '').includes('jpeg')
          ? 'jpg'
          : (job.outputContentType || '').includes('mp4')
            ? 'mp4'
            : 'bin'
      headers.set('Content-Disposition', `attachment; filename="studio-${job.id}.${ext}"`)
    }
    for (const name of ['content-range', 'content-length']) {
      const value = upstream.headers.get(name)
      if (value) headers.set(name, value)
    }
    return new Response(upstream.body, { status: upstream.status, headers })
  } catch (err) {
    return studioJsonError(err)
  }
}
