import { getPrisma } from '@/lib/server/db'
import { createId } from '@/lib/supabase/id'

export type ClipEventType = 'preview_play' | 'download' | 'edit_open' | 'delete'

export async function logClipEvent(workspaceId: string, clipId: string, eventType: ClipEventType) {
  const prisma = getPrisma()
  const clip = await prisma.clip.findFirst({ where: { id: clipId, workspaceId, deletedAt: null } })
  if (!clip) return
  await prisma.clipEvent.create({
    data: {
      id: createId('cev'),
      clipId,
      workspaceId,
      eventType,
    },
  })
}
