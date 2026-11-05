import { NextResponse } from 'next/server'
import { jsonError } from '@/lib/server/api-error'
import { getClipForWorkspace } from '@/lib/server/clips/clips'
import { getPrisma } from '@/lib/server/db'
import { resolveWorkspaceId } from '@/lib/server/workspace'
import { getClipStorageForObjectKey } from '@/lib/storage'
import { createCachedSignedDownloadUrl } from '@/lib/storage/signed-download-cache'
import { bgRemovalBlockedReason } from '@/lib/clips/editor/bg-removal'
import { normalizeEdits } from '@/lib/clips/edits'
import { createId } from '@/lib/supabase/id'
import { matteJobTimedOut } from '@/lib/clips/editor/matte-job-status'
import { mattePreviewFingerprint } from '@/lib/server/clips/matte-preview-fingerprint'

const NO_STORE = { 'Cache-Control': 'no-store' }
type Quality = 'standard' | 'detail'
const qualityOf = (raw: unknown): Quality => raw === 'detail' ? 'detail' : 'standard'

async function matteState(workspaceId: string, clipId: string, quality: Quality, fingerprint: string) {
  const prisma = getPrisma()
  const [generations, jobs] = await Promise.all([
    prisma.aiGeneration.findMany({
      where: { workspaceId, clipId, kind: 'BG_MATTE' },
      orderBy: { createdAt: 'desc' },
      take: 25,
      select: { id: true, status: true, storageKey: true, params: true, updatedAt: true },
    }),
    prisma.clipJob.findMany({
      where: { clipId, type: 'BG_MATTE_PREVIEW' },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: { id: true, status: true, payload: true, error: true, createdAt: true },
    }),
  ])
  const matching = generations.filter(gen => {
    const params = gen.params && typeof gen.params === 'object' && !Array.isArray(gen.params)
      ? gen.params as Record<string, unknown> : {}
    return params.quality === quality && params.previewFingerprint === fingerprint
  })
  const recentJob = jobs.find(job => {
    const body = job.payload && typeof job.payload === 'object' && !Array.isArray(job.payload)
      ? job.payload as Record<string, unknown> : {}
    return body.quality === quality && body.previewFingerprint === fingerprint
  })
  // A completed mask is usable even if the worker was interrupted before
  // marking its corresponding job complete. Prefer it over stale RUNNING rows.
  const ready = matching.find(gen => gen.status === 'READY' && gen.storageKey)
  if (ready?.storageKey) {
    const storage = await getClipStorageForObjectKey(ready.storageKey)
    const url = await createCachedSignedDownloadUrl(storage, ready.storageKey, { versionHint: ready.updatedAt.toISOString() })
    return { state: 'ready', url, generationId: ready.id }
  }
  if (recentJob && matteJobTimedOut(recentJob.status, recentJob.createdAt)) {
    return { state: 'failed', url: null, error: 'Matte generation did not finish. Retry the preview.' }
  }
  if (recentJob?.status === 'QUEUED' || recentJob?.status === 'RUNNING') {
    return { state: recentJob.status === 'QUEUED' ? 'queued' : 'processing', url: null, jobId: recentJob.id }
  }
  if (recentJob?.status === 'FAILED') return { state: 'failed', url: null, error: recentJob.error ?? 'Preview generation failed' }
  const row = matching[0]
  if (row?.status === 'RUNNING') return matteJobTimedOut(row.status, row.updatedAt)
    ? { state: 'failed', url: null, error: 'Matte generation stalled. Retry the preview.' }
    : { state: 'processing', url: null }
  if (row?.status === 'FAILED') return { state: 'failed', url: null }
  return { state: 'idle', url: null }
}

/** Workspace-scoped status for an actual generated matte; never fake a mask. */
export async function GET(request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params
    const workspaceId = await resolveWorkspaceId()
    const clip = await getClipForWorkspace(workspaceId, id)
    if (!clip) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    const quality = qualityOf(new URL(request.url).searchParams.get('quality'))
    return NextResponse.json({ data: await matteState(workspaceId, id, quality, mattePreviewFingerprint(clip)) }, { headers: NO_STORE })
  } catch (err) {
    return jsonError(err, 500)
  }
}

/**
 * Generate a short real person matte in the background, before export.
 * This is a free editor preview (0 user credits), not an export.
 * Reuse completed generations and dedupe active jobs for the same clip/quality.
 */
export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params
    const workspaceId = await resolveWorkspaceId()
    const clip = await getClipForWorkspace(workspaceId, id)
    if (!clip) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    const body = (await request.json().catch(() => ({}))) as { quality?: unknown }
    const quality = qualityOf(body.quality)
    const edits = normalizeEdits(clip.edits, { clipStartMs: clip.startMs, clipEndMs: clip.endMs })
    const blocked = bgRemovalBlockedReason(edits)
    if (blocked) return NextResponse.json({ error: blocked }, { status: 400 })
    const existing = await matteState(workspaceId, id, quality, mattePreviewFingerprint(clip))
    if (existing.state === 'ready' || existing.state === 'queued' || existing.state === 'processing')
      return NextResponse.json({ data: { ...existing, credits: 0 } }, { headers: NO_STORE })
    const prisma = getPrisma()
    const created = await prisma.clipJob.create({
      data: {
        id: createId('job'),
        projectId: clip.projectId,
        clipId: id,
        type: 'BG_MATTE_PREVIEW',
        status: 'QUEUED',
        maxAttempts: 1,
        payload: { clipId: id, workspaceId, quality, previewSeconds: 6, previewStartMs: edits.trim.in, previewFingerprint: mattePreviewFingerprint(clip) },
      },
    })
    return NextResponse.json({ data: { state: 'queued', jobId: created.id, url: null, credits: 0 } }, { status: 202, headers: NO_STORE })
  } catch (err) {
    return jsonError(err, 500)
  }
}
