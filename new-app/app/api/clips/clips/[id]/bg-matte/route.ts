import { NextResponse } from 'next/server'
import { jsonError } from '@/lib/server/api-error'
import { getClipForWorkspace } from '@/lib/server/clips/clips'
import { getPrisma } from '@/lib/server/db'
import { resolveWorkspaceId } from '@/lib/server/workspace'
import { getClipStorageForObjectKey } from '@/lib/storage'
import { createCachedSignedDownloadUrl } from '@/lib/storage/signed-download-cache'

/**
 * E2: A matte is created by the existing export worker, not by this GET.
 * Return only the signed grayscale person mask for this workspace's clip.
 * The editor can display it as a genuine low-resolution mask preview after generation.
 */
export async function GET(request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params
    const workspaceId = await resolveWorkspaceId()
    const clip = await getClipForWorkspace(workspaceId, id)
    if (!clip) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    const quality = new URL(request.url).searchParams.get('quality') === 'detail' ? 'detail' : 'standard'
    const generations = await getPrisma().aiGeneration.findMany({
      where: { workspaceId, clipId: id, kind: 'BG_MATTE' },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: { id: true, status: true, storageKey: true, params: true, updatedAt: true },
    })
    const row = generations.find((gen) => {
      const params = gen.params && typeof gen.params === 'object' && !Array.isArray(gen.params)
        ? gen.params as Record<string, unknown> : {}
      return params.quality === quality
    })
    if (!row) return NextResponse.json({ data: { state: 'idle', url: null } }, { headers: { 'Cache-Control': 'no-store' } })
    if (row.status === 'READY' && row.storageKey) {
      const storage = getClipStorageForObjectKey(row.storageKey)
      const url = await createCachedSignedDownloadUrl(storage, row.storageKey, { versionHint: row.updatedAt.toISOString() })
      return NextResponse.json({ data: { state: 'ready', url, generationId: row.id } }, { headers: { 'Cache-Control': 'no-store' } })
    }
    const state = row.status === 'FAILED' ? 'failed' : row.status === 'RUNNING' ? 'processing' : 'queued'
    return NextResponse.json({ data: { state, url: null } }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (err) {
    return jsonError(err, 500)
  }
}
