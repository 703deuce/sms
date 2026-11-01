import 'server-only'

import { isFullVideoSettings } from '@/lib/clips/full-video'
import { clipProjectSettingsSchema } from '@/lib/clips/settings'
import { getPrisma } from '@/lib/server/db'

/** Found-clips grid → full-video editor with highlights lane open. */
export async function resolveViewOnFullVideoUrl(
  workspaceId: string,
  foundProjectId: string,
  projectSettings: unknown,
  uploadId: string | null,
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
    const candidates = await prisma.clipProject.findMany({
      where: { workspaceId, uploadId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      select: { id: true, settings: true, createdAt: true },
    })
    const foundCreated =
      (
        await prisma.clipProject.findUnique({
          where: { id: foundProjectId },
          select: { createdAt: true },
        })
      )?.createdAt ?? new Date()
    const fv = candidates.find((p) => isFullVideoSettings(p.settings) && p.createdAt < foundCreated)
    fvId = fv?.id ?? null
  }
  if (!fvId) return null
  const clip = await prisma.clip.findFirst({
    where: { projectId: fvId, workspaceId, deletedAt: null },
    orderBy: { startMs: 'asc' },
    select: { id: true },
  })
  if (!clip) return null
  return `/app/clips/${fvId}/edit/${clip.id}?highlights=1`
}
