import { createId } from '@/lib/supabase/id'
import { getPrisma } from '@/lib/server/db'
import { stopChannelRollingAutopull } from '@/lib/server/streamer/rolling-autopull'
import { streamerSettingsSchema } from '@/lib/streamer/settings'

const LOGIN_RE = /^[a-z0-9_]{2,25}$/i

export async function listStreamerChannels(workspaceId: string) {
  const prisma = getPrisma()
  const channels = await prisma.streamChannel.findMany({
    where: { workspaceId, deletedAt: null },
    orderBy: { updatedAt: 'desc' },
    include: {
      vods: {
        where: { project: { deletedAt: null } },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: { id: true, title: true, projectId: true, createdAt: true },
      },
    },
  })
  return channels.map((ch) => ({
    id: ch.id,
    platform: ch.platform,
    login: ch.login,
    displayName: ch.displayName,
    avatarUrl: ch.avatarUrl,
    status: ch.status,
    autoProcess: ch.autoProcess,
    settings: ch.settings,
    defaultPresetId: ch.defaultPresetId,
    recentVods: ch.vods.map((v) => ({
      id: v.id,
      title: v.title,
      projectId: v.projectId,
      createdAt: v.createdAt.toISOString(),
    })),
  }))
}

export async function createPasteChannel(workspaceId: string, platform: string, login: string) {
  const normalized = login.trim().toLowerCase()
  if (!LOGIN_RE.test(normalized)) throw new Error('Invalid channel login')
  const prisma = getPrisma()
  const id = createId('sch')
  const row = await prisma.streamChannel.upsert({
    where: { workspaceId_platform_login: { workspaceId, platform, login: normalized } },
    create: {
      id,
      workspaceId,
      platform,
      login: normalized,
      status: 'PASTE_ONLY',
    },
    update: { deletedAt: null, updatedAt: new Date() },
  })
  return row
}

export async function patchStreamerChannel(
  workspaceId: string,
  channelId: string,
  patch: { settings?: unknown; autoProcess?: boolean; defaultPresetId?: string | null },
) {
  const prisma = getPrisma()
  const ch = await prisma.streamChannel.findFirst({ where: { id: channelId, workspaceId, deletedAt: null } })
  if (!ch) throw new Error('Not found')
  if (patch.autoProcess === true && ch.status !== 'CONNECTED') {
    throw new Error('Connect the channel before enabling auto-process')
  }
  const mergedSettings =
    patch.settings !== undefined
      ? {
          ...(typeof ch.settings === 'object' && ch.settings ? ch.settings : {}),
          ...streamerSettingsSchema.partial().parse(patch.settings),
        }
      : undefined
  if (patch.autoProcess === false) {
    await stopChannelRollingAutopull(channelId, 'auto_process_off')
  }
  return prisma.streamChannel.update({
    where: { id: channelId },
    data: {
      ...(mergedSettings !== undefined ? { settings: mergedSettings } : {}),
      ...(patch.autoProcess !== undefined ? { autoProcess: patch.autoProcess } : {}),
      ...(patch.defaultPresetId !== undefined ? { defaultPresetId: patch.defaultPresetId } : {}),
    },
  })
}
