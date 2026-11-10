import { NextResponse } from 'next/server'
import { jsonError } from '@/lib/server/api-error'
import { getPrisma } from '@/lib/server/db'
import { resolveWorkspaceId } from '@/lib/server/workspace'
import { isFullVideoSettings } from '@/lib/clips/full-video'
import { getClipStorageForObjectKey, getClipStorage } from '@/lib/storage'
import { createCachedSignedDownloadUrl } from '@/lib/storage/signed-download-cache'
import { resolveEditorAssets } from '@/lib/server/clips/editor-assets'

// Polling has no side effects: the initial source is playable before the proxy is ready.
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const startedAt = Date.now()
  try {
    const { id } = await ctx.params
    const workspaceId = await resolveWorkspaceId()
    const prisma = getPrisma()
    const project = await prisma.clipProject.findFirst({
      where: { id, workspaceId, deletedAt: null },
      select: {
        id: true, status: true, stage: true, progress: true, error: true,
        settings: true, proxyKey: true, updatedAt: true,
        upload: { select: { storageDriver: true } },
      },
    })
    if (!project || !isFullVideoSettings(project.settings)) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    const clip = await prisma.clip.findFirst({
      where: { projectId: id, workspaceId, deletedAt: null },
      orderBy: { startMs: 'asc' },
      select: { aiMeta: true },
    })
    const driver = project.upload?.storageDriver ?? null
    const [proxy, editorAssets] = await Promise.all([
      project.proxyKey
        ? getClipStorageForObjectKey(project.proxyKey, driver).then((storage) =>
            createCachedSignedDownloadUrl(storage, project.proxyKey!, {
              versionHint: project.updatedAt.toISOString(),
            }),
          ).catch(() => null)
        : Promise.resolve(null),
      clip?.aiMeta
        ? resolveEditorAssets(getClipStorage(driver), clip.aiMeta, project.updatedAt.toISOString()).catch(() => null)
        : Promise.resolve(null),
    ])
    console.log('[clipper:fullvideo-prepare] step=status', {
      projectId: id, stage: project.stage, progress: project.progress,
      hasProxy: Boolean(proxy), elapsedMs: Date.now() - startedAt,
    })
    return NextResponse.json({ data: {
      status: project.status,
      stage: project.stage,
      progress: project.progress,
      error: project.error,
      proxy,
      editorAssets,
    } })
  } catch (error) {
    console.warn('[clipper:fullvideo-prepare] step=failed', {
      elapsedMs: Date.now() - startedAt,
      errorName: error instanceof Error ? error.name : 'UnknownError',
    })
    return jsonError(error)
  }
}
