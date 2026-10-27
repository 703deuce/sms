import 'server-only'
import { getPrisma } from '@/lib/server/db'

export type MediaLibraryUploadRow = {
  id: string
  filename: string
  bytes: number
  mime: string
  durationMs: number | null
  createdAt: string
  projectIds: { id: string; title: string; status: string }[]
}

export async function listMediaLibraryUploads(workspaceId: string, limit = 80): Promise<MediaLibraryUploadRow[]> {
  const prisma = getPrisma()
  const rows = await prisma.clipUpload.findMany({
    where: { workspaceId, status: 'COMPLETE' },
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: {
      id: true,
      filename: true,
      bytes: true,
      mime: true,
      durationMs: true,
      createdAt: true,
      projects: {
        where: { deletedAt: null },
        select: { id: true, title: true, status: true },
        orderBy: { updatedAt: 'desc' },
        take: 5,
      },
    },
  })
  return rows.map((r) => ({
    id: r.id,
    filename: r.filename,
    bytes: Number(r.bytes),
    mime: r.mime,
    durationMs: r.durationMs,
    createdAt: r.createdAt.toISOString(),
    projectIds: r.projects.map((p) => ({ id: p.id, title: p.title, status: p.status })),
  }))
}
