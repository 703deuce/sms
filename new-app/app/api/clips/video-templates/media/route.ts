import { NextResponse } from 'next/server'
import { jsonError } from '@/lib/server/api-error'
import { getPrisma } from '@/lib/server/db'
import { resolveWorkspaceId } from '@/lib/server/workspace'
import { createReadableSignedUrl } from '@/lib/storage'
import type { TemplateAsset } from '@/lib/clips/real-video-templates/sequence-contract'

/** Workspace-scoped uploads only. No stock URLs or media belonging to another workspace. */
export async function GET(req: Request) {
  try {
    const workspaceId = await resolveWorkspaceId()
    const search = new URL(req.url).searchParams
    const page = Math.min(10000, Math.max(1, Number.parseInt(search.get('page') || '1', 10) || 1))
    const q = (search.get('q') ?? '').trim().slice(0, 120)
    const kind = search.get('kind') ?? ''
    if (kind && !['video','image','audio'].includes(kind)) return NextResponse.json({ error: 'Invalid media filter' }, { status: 400 })
    // Resolve selected uploads by ID even when they are beyond the current picker page.
    // IDs are workspace-scoped; URLs and storage keys are never accepted as selectors.
    const requestedIds = search.get('ids')
    const ids = requestedIds === null ? null : [...new Set(requestedIds.split(','))]
    if (ids && (!ids.length || ids.length > 60 || ids.some(id => !/^[A-Za-z0-9_-]{1,120}$/.test(id))))
      return NextResponse.json({ error: 'Invalid media IDs' }, { status: 400 })
    const where = ids ? { workspaceId, status: 'COMPLETE', id: { in: ids } } : {
      workspaceId, status: 'COMPLETE',
      ...(q ? { filename: { contains: q, mode: 'insensitive' as const } } : {}),
      ...(kind ? { mime: { startsWith: kind + '/' } } : {
        OR: [{ mime: { startsWith: 'video/' } }, { mime: { startsWith: 'image/' } }, { mime: { startsWith: 'audio/' } }],
      }),
    }
    const prisma = getPrisma()
    const [total, rows] = await Promise.all([
      prisma.clipUpload.count({ where }),
      prisma.clipUpload.findMany({ where, orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        take: ids ? ids.length : 60, skip: ids ? 0 : (page - 1) * 60,
        select: { id: true, key: true, filename: true, mime: true, durationMs: true,
          bytes: true, width: true, height: true, storageDriver: true },
      }),
    ])
    const items = await Promise.all(rows.map(async row => {
      const kind: TemplateAsset['kind'] = row.mime.startsWith('image/') ? 'image' :
        row.mime.startsWith('audio/') ? 'audio' : 'video'
      const frames = row.durationMs ? Math.floor(row.durationMs * 30 / 1000) : undefined
      const asset: TemplateAsset = {
        id: row.id, kind, license: { id: 'user_owned', provenance: 'user-owned', reference: 'workspace_upload' },
        ...(kind !== 'image' && frames ? { durationFrames: frames } : {}),
      }
      let url: string | null = null
      try {
        url = await createReadableSignedUrl(row.key, 3600)
      } catch { /* unsigned/unavailable assets remain unselectable */ }
      const stillUrl = kind === 'image' ? url : null
      return {
        asset, label: row.filename, bytes: Number(row.bytes), mime: row.mime, width: row.width,
        height: row.height, durationMs: row.durationMs, url, stillUrl,
        available: Boolean(url && (kind === 'image' || frames)),
      }
    }))
    return NextResponse.json({ data: { items, total, page: ids ? 1 : page,
      pages: ids ? 1 : Math.max(1, Math.ceil(total / 60)) } })
  } catch (error) { return jsonError(error, 500) }
}
