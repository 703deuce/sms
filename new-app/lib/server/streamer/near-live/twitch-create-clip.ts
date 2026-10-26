import { decryptIntegrationSecret } from '@/lib/integrations/framework/secrets'
import { getPrisma } from '@/lib/server/db'
import { twitchClientId } from '@/lib/server/streamer/twitch'

/** Twitch Helix Create Clip (requires clips:edit on channel connection). */
export async function createTwitchClipForChannel(
  channelId: string,
  opts?: { hasDelay?: boolean },
): Promise<{ clipId: string; editUrl: string } | null> {
  const prisma = getPrisma()
  const channel = await prisma.streamChannel.findUnique({ where: { id: channelId } })
  if (!channel?.connectionId || channel.platform !== 'twitch') return null
  const conn = await prisma.integrationConnection.findUnique({ where: { id: channel.connectionId } })
  const token = decryptIntegrationSecret(conn?.accessToken)
  if (!token) return null
  const broadcasterId = channel.externalId
  const params = new URLSearchParams({ broadcaster_id: broadcasterId })
  if (opts?.hasDelay === false) params.set('has_delay', 'false')
  const res = await fetch(`https://api.twitch.tv/helix/clips?${params}`, {
    method: 'POST',
    headers: {
      'Client-Id': twitchClientId(),
      Authorization: `Bearer ${token}`,
    },
  })
  if (!res.ok) return null
  const json = (await res.json()) as { data?: { id: string; edit_url: string }[] }
  const clip = json.data?.[0]
  if (!clip?.id) return null
  return { clipId: clip.id, editUrl: clip.edit_url }
}
