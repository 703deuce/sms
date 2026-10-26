import { encryptIntegrationSecret, decryptIntegrationSecret } from '@/lib/integrations/framework/secrets'
import { streamerLiveRealtimeEnabled, twitchRedirectUri, twitchWebhookUrl } from '@/lib/server/streamer/env'

export { twitchRedirectUri }
import { getPrisma } from '@/lib/server/db'
import { createId } from '@/lib/supabase/id'

/** Add `clips:edit` before enabling near-live !clip in production. */
const SCOPES = ['user:read:chat', 'user:bot', 'channel:bot']

export function twitchClientId(): string {
  const id = process.env.TWITCH_CLIENT_ID?.trim()
  if (!id) throw new Error('TWITCH_CLIENT_ID not configured')
  return id
}

export function twitchClientSecret(): string {
  const s = process.env.TWITCH_CLIENT_SECRET?.trim()
  if (!s) throw new Error('TWITCH_CLIENT_SECRET not configured')
  return s
}

export async function twitchAppAccessToken(): Promise<string> {
  const res = await fetch('https://id.twitch.tv/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: twitchClientId(),
      client_secret: twitchClientSecret(),
      grant_type: 'client_credentials',
    }),
  })
  if (!res.ok) throw new Error(`Twitch app token failed: ${res.status}`)
  const json = (await res.json()) as { access_token: string }
  return json.access_token
}

export async function exchangeTwitchCode(code: string, redirectUri: string) {
  const res = await fetch('https://id.twitch.tv/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: twitchClientId(),
      client_secret: twitchClientSecret(),
      code,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri,
    }),
  })
  if (!res.ok) throw new Error(`Twitch token exchange failed: ${res.status}`)
  return (await res.json()) as {
    access_token: string
    refresh_token: string
    expires_in: number
    scope: string[]
  }
}

export async function twitchUsersMe(userToken: string) {
  const res = await fetch('https://api.twitch.tv/helix/users', {
    headers: {
      'Client-Id': twitchClientId(),
      Authorization: `Bearer ${userToken}`,
    },
  })
  if (!res.ok) throw new Error('Twitch users lookup failed')
  const json = (await res.json()) as { data: { id: string; login: string; display_name: string; profile_image_url: string }[] }
  const user = json.data?.[0]
  if (!user) throw new Error('No Twitch user')
  return user
}

export async function upsertTwitchConnection(
  workspaceId: string,
  tokens: { access_token: string; refresh_token: string; expires_in: number; scope: string[] },
  user: { id: string; login: string; display_name: string; profile_image_url: string },
) {
  const prisma = getPrisma()
  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000)
  const conn = await prisma.integrationConnection.upsert({
    where: { workspaceId_provider: { workspaceId, provider: 'twitch' } },
    create: {
      id: createId('icon'),
      workspaceId,
      provider: 'twitch',
      status: 'connected',
      accessToken: encryptIntegrationSecret(tokens.access_token),
      refreshToken: encryptIntegrationSecret(tokens.refresh_token),
      expiresAt,
      externalId: user.id,
      connectedAccountName: user.display_name,
      configJson: { scopes: tokens.scope },
    },
    update: {
      status: 'connected',
      accessToken: encryptIntegrationSecret(tokens.access_token),
      refreshToken: encryptIntegrationSecret(tokens.refresh_token),
      expiresAt,
      externalId: user.id,
      connectedAccountName: user.display_name,
      configJson: { scopes: tokens.scope },
    },
  })
  const channel = await prisma.streamChannel.upsert({
    where: { workspaceId_platform_login: { workspaceId, platform: 'twitch', login: user.login.toLowerCase() } },
    create: {
      id: createId('sch'),
      workspaceId,
      platform: 'twitch',
      login: user.login.toLowerCase(),
      externalId: user.id,
      displayName: user.display_name,
      avatarUrl: user.profile_image_url,
      connectionId: conn.id,
      status: 'CONNECTED',
    },
    update: {
      externalId: user.id,
      displayName: user.display_name,
      avatarUrl: user.profile_image_url,
      connectionId: conn.id,
      status: 'CONNECTED',
      deletedAt: null,
    },
  })
  return { connection: conn, channel }
}

export async function createTwitchEventsubSubscriptions(broadcasterId: string): Promise<string[]> {
  const appToken = await twitchAppAccessToken()
  const secret = process.env.TWITCH_EVENTSUB_SECRET?.trim()
  if (!secret) throw new Error('TWITCH_EVENTSUB_SECRET not configured')
  const callback = twitchWebhookUrl()
  const types: { type: string; version: string; condition: Record<string, string> }[] = [
    { type: 'stream.online', version: '1', condition: { broadcaster_user_id: broadcasterId } },
    { type: 'stream.offline', version: '1', condition: { broadcaster_user_id: broadcasterId } },
    { type: 'channel.update', version: '2', condition: { broadcaster_user_id: broadcasterId } },
  ]
  if (streamerLiveRealtimeEnabled()) {
    types.push({
      type: 'channel.chat.message',
      version: '1',
      condition: { broadcaster_user_id: broadcasterId, user_id: broadcasterId },
    })
  }
  const ids: string[] = []
  for (const sub of types) {
    const res = await fetch('https://api.twitch.tv/helix/eventsub/subscriptions', {
      method: 'POST',
      headers: {
        'Client-Id': twitchClientId(),
        Authorization: `Bearer ${appToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: sub.type,
        version: sub.version,
        condition: sub.condition,
        transport: { method: 'webhook', callback, secret },
      }),
    })
    if (!res.ok) {
      const text = await res.text()
      throw new Error(`EventSub ${sub.type} failed: ${res.status} ${text}`)
    }
    const json = (await res.json()) as { data: { id: string }[] }
    if (json.data?.[0]?.id) ids.push(json.data[0].id)
  }
  return ids
}

export function decryptTwitchToken(enc: string | null | undefined): string | null {
  if (!enc) return null
  try {
    return decryptIntegrationSecret(enc)
  } catch {
    return null
  }
}

export function twitchAuthorizeUrl(state: string, redirectUri: string): string {
  const params = new URLSearchParams({
    client_id: twitchClientId(),
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: SCOPES.join(' '),
    state,
    force_verify: 'true',
  })
  return `https://id.twitch.tv/oauth2/authorize?${params}`
}

export function getTwitchVodDelaySec(): number {
  return Number(process.env.TWITCH_VOD_DELAY_S || 120)
}
