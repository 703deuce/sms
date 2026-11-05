import { NextResponse } from 'next/server'
import { resolveWorkspaceId } from '@/lib/server/workspace'
import { getClipEditorPayload } from '@/lib/server/clips/clip-detail'
import { getClipForWorkspace } from '@/lib/server/clips/clips'
import { mattePreviewFingerprint } from '@/lib/server/clips/matte-preview-fingerprint'
import { getPrisma } from '@/lib/server/db'
import { getClipStorageForObjectKey } from '@/lib/storage'
import { createCachedSignedDownloadUrl } from '@/lib/storage/signed-download-cache'

/**
 * Same-origin, authenticated media stream for the editor's person matte canvas.
 * Signed storage URLs may allow playback but not pixel reads (CORS fallback).
 * Never proxy an arbitrary client supplied URL.
 */
export async function GET(request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params
    const workspaceId = await resolveWorkspaceId()
    const payload = await getClipEditorPayload(workspaceId, id)
    if (!payload) return NextResponse.json({ error: 'Clip not found' }, { status: 404 })
    const kind = new URL(request.url).searchParams.get('kind')
    if (!kind || !['proxy', 'segment', 'source', 'preview', 'matte'].includes(kind))
      return NextResponse.json({ error: 'Invalid media kind' }, { status: 400 })
    const urls = payload.mediaUrls
    let url: string | null | undefined
    if (kind === 'matte') {
      const quality = new URL(request.url).searchParams.get('quality') === 'detail' ? 'detail' : 'standard'
      const clip = await getClipForWorkspace(workspaceId, id)
      if (!clip) return NextResponse.json({ error: 'Not found' }, { status: 404 })
      const fingerprint = mattePreviewFingerprint(clip)
      const generations = await getPrisma().aiGeneration.findMany({
        where: { workspaceId, clipId: id, kind: 'BG_MATTE', status: 'READY' },
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: { storageKey: true, params: true, updatedAt: true },
      })
      const match = generations.find(g => g.storageKey &&
        g.params && typeof g.params === 'object' && !Array.isArray(g.params) &&
        (g.params as Record<string, unknown>).quality === quality &&
        (g.params as Record<string, unknown>).previewFingerprint === fingerprint)
      if (match?.storageKey) {
        const storage = await getClipStorageForObjectKey(match.storageKey)
        url = await createCachedSignedDownloadUrl(storage, match.storageKey, { versionHint: match.updatedAt.toISOString() })
      }
    } else {
      url = urls[kind as keyof typeof urls]
    }
    if (typeof url !== 'string' || !url.startsWith('https://'))
      return NextResponse.json({ error: 'Media not ready' }, { status: 404 })
    const range = request.headers.get('range')
    const upstream = await fetch(url, {
      headers: range ? { Range: range } : {},
      cache: 'no-store',
      signal: request.signal,
    })
    if (!upstream.ok || !upstream.body)
      return NextResponse.json({ error: 'Media unavailable' }, { status: 502 })
    const headers = new Headers({
      'Content-Type': upstream.headers.get('content-type') ?? 'video/mp4',
      'Cache-Control': 'private, no-store',
      'Accept-Ranges': upstream.headers.get('accept-ranges') ?? 'bytes',
      'X-Content-Type-Options': 'nosniff',
    })
    for (const name of ['content-range', 'content-length']) {
      const value = upstream.headers.get(name)
      if (value) headers.set(name, value)
    }
    return new Response(upstream.body, { status: upstream.status, headers })
  } catch {
    return NextResponse.json({ error: 'Unable to load clip media' }, { status: 500 })
  }
}
