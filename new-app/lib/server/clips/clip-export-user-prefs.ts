import type { Prisma } from '@prisma/client'
import {
  mergeClipExportUserPrefs,
  type ClipExportUserPreferences,
  type ClipUserStreamerChannelRow,
} from '@/lib/clips/clip-export-user-types'
import { getPrisma } from '@/lib/server/db'
import { createId } from '@/lib/supabase/id'

export type { ClipExportUserPreferences, ClipUserStreamerChannelRow } from '@/lib/clips/clip-export-user-types'
export { mergeClipExportUserPrefs } from '@/lib/clips/clip-export-user-types'

export async function getClipExportUserPrefs(workspaceId: string, userId: string) {
  const prisma = getPrisma()
  const row = await prisma.clipExportUserPrefs.findUnique({
    where: { workspaceId_userId: { workspaceId, userId } },
  })
  return mergeClipExportUserPrefs(row?.prefs)
}

export async function saveClipExportUserPrefs(
  workspaceId: string,
  userId: string,
  patch: Partial<ClipExportUserPreferences>,
) {
  const prisma = getPrisma()
  const current = await getClipExportUserPrefs(workspaceId, userId)
  const next = { ...current, ...patch }
  await prisma.clipExportUserPrefs.upsert({
    where: { workspaceId_userId: { workspaceId, userId } },
    create: {
      id: createId('cexp'),
      workspaceId,
      userId,
      prefs: next as Prisma.InputJsonValue,
    },
    update: { prefs: next as Prisma.InputJsonValue },
  })
  return next
}

export async function listClipUserStreamerChannels(
  workspaceId: string,
  userId: string,
): Promise<ClipUserStreamerChannelRow[]> {
  const prisma = getPrisma()
  const rows = await prisma.clipUserStreamerChannel.findMany({
    where: { workspaceId, userId },
    orderBy: { createdAt: 'asc' },
    take: 20,
  })
  return rows
    .filter((r) => r.platform === 'twitch' || r.platform === 'kick')
    .map((r) => ({
      id: r.id,
      platform: r.platform as 'twitch' | 'kick',
      label: r.label,
      url: r.url,
    }))
}

export async function upsertClipUserStreamerChannel(
  workspaceId: string,
  userId: string,
  input: { platform: 'twitch' | 'kick'; url: string; label?: string },
) {
  const prisma = getPrisma()
  const url = input.url.trim()
  const existing = await prisma.clipUserStreamerChannel.findFirst({
    where: { workspaceId, userId, url },
  })
  if (existing) {
    return {
      id: existing.id,
      platform: existing.platform as 'twitch' | 'kick',
      label: existing.label,
      url: existing.url,
    }
  }
  const row = await prisma.clipUserStreamerChannel.create({
    data: {
      id: createId('cuch'),
      workspaceId,
      userId,
      platform: input.platform,
      url,
      label: input.label?.trim() || null,
    },
  })
  return {
    id: row.id,
    platform: row.platform as 'twitch' | 'kick',
    label: row.label,
    url: row.url,
  }
}

export async function deleteClipUserStreamerChannel(
  workspaceId: string,
  userId: string,
  channelId: string,
) {
  const prisma = getPrisma()
  await prisma.clipUserStreamerChannel.deleteMany({
    where: { id: channelId, workspaceId, userId },
  })
}
