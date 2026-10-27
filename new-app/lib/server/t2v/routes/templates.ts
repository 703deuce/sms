import 'server-only'
import { NextResponse } from 'next/server'
import { getPrisma } from '@/lib/server/db'
import { resolveWorkspaceId } from '@/lib/server/workspace'
import { getClipStorage } from '@/lib/storage'
import type { T2vTemplateListItem } from '@/lib/t2v/m9-contracts'

const THUMB_TTL = 3600

export async function listT2vTemplates(query: { category?: string; aspect?: string }) {
  const workspaceId = await resolveWorkspaceId()
  const prisma = getPrisma()
  const rows = await prisma.t2vTemplate.findMany({
    where: {
      isPublished: true,
      OR: [{ workspaceId: null }, { workspaceId }],
      ...(query.category ? { category: query.category } : {}),
      ...(query.aspect ? { aspect: query.aspect } : {}),
    },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    take: 80,
  })
  const storage = getClipStorage()
  const templates: T2vTemplateListItem[] = await Promise.all(
    rows.map(async (r) => {
      let thumbUrl: string | null = null
      let previewUrl: string | null = null
      if (r.thumbKey) {
        try {
          thumbUrl = await storage.createSignedDownloadUrl(r.thumbKey, THUMB_TTL)
        } catch {
          thumbUrl = null
        }
      }
      if (r.previewKey) {
        try {
          previewUrl = await storage.createSignedDownloadUrl(r.previewKey, THUMB_TTL)
        } catch {
          previewUrl = null
        }
      }
      const settings = r.settings as { description?: string }
      return {
        id: r.id,
        name: r.name,
        category: r.category as T2vTemplateListItem['category'],
        aspect: r.aspect as T2vTemplateListItem['aspect'],
        thumbUrl,
        previewUrl,
        sampleScript: r.sampleScript,
        description: settings?.description ?? null,
      }
    }),
  )
  return NextResponse.json({ data: { templates } })
}
