import 'server-only'

import { clipProjectSettingsSchema } from '@/lib/clips/settings'
import { getPrisma } from '@/lib/server/db'

/** Found-clips grid → full-video editor with highlights lane open. */
export async function resolveViewOnFullVideoUrl(
  workspaceId: string,
  foundProjectId: string,
  projectSettings: unknown,
  uploadId: string | null,
  foundProjectCreatedAt?: Date,
): Promise<string | null> {
  const parsed = clipProjectSettingsSchema.safeParse(projectSettings)
  let fvId = parsed.success ? parsed.data.fromFullVideoProjectId : null
  const prisma = getPrisma()
  if (fvId) {
    const linked = await prisma.clipProject.findFirst({
      where: { id: fvId, workspaceId, deletedAt: null },
      select: { id: true },
    })
    if (!linked) fvId = null
  }
  if (!fvId && uploadId) {
    const foundCreatedAt = foundProjectCreatedAt ??
      (await prisma.clipProject.findFirst({
        where: { id: foundProjectId, workspaceId },
        select: { createdAt: true },
      }))?.createdAt ?? new Date()
    const started = Date.now()
    const fv = await prisma.clipProject.findFirst({
      where: {
        workspaceId, uploadId, deletedAt: null,
        createdAt: { lt: foundCreatedAt },
        settings: { path: ['fullVideo'], equals: true },
      },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    })
    console.info('[page:timing]', { path: '/app/clips/[projectId]', query: 'full_video_indexed_lookup', elapsedMs: Date.now() - started, rows: fv ? 1 : 0 })
    fvId = fv?.id ?? null
  }
  if (!fvId) return null
  const clip = await prisma.clip.findFirst({
    where: { projectId: fvId, workspaceId, deletedAt: null },
    orderBy: { startMs: 'asc' },
    select: { id: true },
  })
  if (!clip) return null
  return `/app/video-editor/${fvId}/edit/${clip.id}?highlights=1`
}
