import { createHash, randomBytes } from 'node:crypto'
import { encryptIntegrationSecret, decryptIntegrationSecret } from '@/lib/integrations/framework/secrets'
import { kickRedirectUri, kickWebhookUrl } from '@/lib/server/streamer/env'
import { getPrisma } from '@/lib/server/db'
import { createId } from '@/lib/supabase/id'

const SCOPES = ['user:read', 'channel:read', 'events:subscribe']

export function kickClientId(): string {
  const id = process.env.KICK_CLIENT_ID?.trim()
  if (!id) throw new Error('KICK_CLIENT_ID not configured')
  return id
}

export function kickClientSecret(): string {
  const s = process.env.KICK_CLIENT_SECRET?.trim()
  if (!s) throw new Error('KICK_CLIENT_SECRET not configured')
  return s
}

export function createKickPkceVerifier(): string {
  return randomBytes(48).toString('base64url').slice(0, 64)
}

export function kickCodeChallenge(verifier: string): string {
  return createHash('sha256').update(verifier).digest('base64url')
}

export function kickAuthorizeUrl(state: string, challenge: string): string {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: kickClientId(),
    redirect_uri: kickRedirectUri(),
    scope: SCOPES.join(' '),
    state,
    code_challenge: challenge,
    code_challenge_method: 'S256',
  })
  return `https://id.kick.com/oauth/authorize?${params}`
}

export async function exchangeKickCode(code: string, verifier: string) {
  const res = await fetch('https://id.kick.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: kickClientId(),
      client_secret: kickClientSecret(),
      code,
      redirect_uri: kickRedirectUri(),
      code_verifier: verifier,
    }),
  })
  if (!res.ok) throw new Error(`Kick token exchange failed: ${res.status}`)
  return (await res.json()) as { access_token: string; refresh_token: string; expires_in: number }
}

export async function kickUser(accessToken: string) {
  const res = await fetch('https://api.kick.com/public/v1/users', {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) throw new Error('Kick user lookup failed')
  const json = (await res.json()) as { data: { user_id: number; name: string } }
  return json.data
}

export async function kickChannel(accessToken: string) {
  const res = await fetch('https://api.kick.com/public/v1/channels', {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) throw new Error('Kick channel lookup failed')
  const json = (await res.json()) as { data: { slug: string; broadcaster_user_id: number }[] }
  const ch = json.data?.[0]
  if (!ch) throw new Error('No Kick channel')
  return ch
}

export async function upsertKickConnection(
  workspaceId: string,
  tokens: { access_token: string; refresh_token: string; expires_in: number },
  user: { user_id: number; name: string },
  channel: { slug: string; broadcaster_user_id: number },
) {
  const prisma = getPrisma()
  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000)
  const conn = await prisma.integrationConnection.upsert({
    where: { workspaceId_provider: { workspaceId, provider: 'kick' } },
    create: {
      id: createId('icon'),
      workspaceId,
      provider: 'kick',
      status: 'connected',
      accessToken: encryptIntegrationSecret(tokens.access_token),
      refreshToken: encryptIntegrationSecret(tokens.refresh_token),
      expiresAt,
      externalId: String(channel.broadcaster_user_id),
      connectedAccountName: user.name,
    },
    update: {
      status: 'connected',
      accessToken: encryptIntegrationSecret(tokens.access_token),
      refreshToken: encryptIntegrationSecret(tokens.refresh_token),
      expiresAt,
      externalId: String(channel.broadcaster_user_id),
      connectedAccountName: user.name,
    },
  })
  const row = await prisma.streamChannel.upsert({
    where: { workspaceId_platform_login: { workspaceId, platform: 'kick', login: channel.slug.toLowerCase() } },
    create: {
      id: createId('sch'),
      workspaceId,
      platform: 'kick',
      login: channel.slug.toLowerCase(),
      externalId: String(channel.broadcaster_user_id),
      displayName: user.name,
      connectionId: conn.id,
      status: 'CONNECTED',
    },
    update: {
      externalId: String(channel.broadcaster_user_id),
      displayName: user.name,
      connectionId: conn.id,
      status: 'CONNECTED',
      deletedAt: null,
    },
  })
  return { connection: conn, channel: row }
}

export function decryptKickToken(enc: string | null | undefined): string | null {
  if (!enc) return null
  try {
    return decryptIntegrationSecret(enc)
  } catch {
    return null
  }
}

export function getKickVodDelaySec(): number {
  return Number(process.env.KICK_VOD_DELAY_S || 300)
}

const KICK_EVENT_NAMES = [
  { name: 'livestream.status.updated', version: 1 },
  { name: 'livestream.metadata.updated', version: 1 },
  { name: 'chat.message.sent', version: 1 },
] as const

export async function createKickEventSubscriptions(broadcasterUserId: number): Promise<string[]> {
  const token = await kickAppAccessToken()
  const webhookUrl = kickWebhookUrl()
  const res = await fetch('https://api.kick.com/public/v1/events/subscriptions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      broadcaster_user_id: broadcasterUserId,
      method: 'webhook',
      events: KICK_EVENT_NAMES.map((e) => ({ name: e.name, version: e.version })),
      webhook_url: webhookUrl,
    }),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Kick subscriptions failed: ${res.status} ${text.slice(0, 300)}`)
  }
  const json = (await res.json()) as { data?: { id: string }[] }
  return (json.data ?? []).map((row) => row.id).filter(Boolean)
}

async function kickAppAccessToken(): Promise<string> {
  const res = await fetch('https://id.kick.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: kickClientId(),
      client_secret: kickClientSecret(),
    }),
  })
  if (!res.ok) throw new Error(`Kick app token failed: ${res.status}`)
  const json = (await res.json()) as { access_token: string }
  return json.access_token
}

export async function deleteKickEventSubscriptions(ids: string[]): Promise<void> {
  const token = await kickAppAccessToken()
  for (const id of ids) {
    await fetch(`https://api.kick.com/public/v1/events/subscriptions?id=${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    })
  }
}

export async function refreshKickUserToken(refreshToken: string) {
  const res = await fetch('https://id.kick.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: kickClientId(),
      client_secret: kickClientSecret(),
      refresh_token: refreshToken,
    }),
  })
  if (!res.ok) throw new Error(`Kick refresh failed: ${res.status}`)
  return (await res.json()) as { access_token: string; refresh_token?: string; expires_in: number }
}

export async function revokeKickToken(token: string) {
  await fetch('https://id.kick.com/oauth/revoke', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      token,
      client_id: kickClientId(),
      client_secret: kickClientSecret(),
    }),
  })
}

export async function ensureKickEventSubscriptions(
  broadcasterUserId: number,
  existingIds: string[],
): Promise<string[]> {
  const token = await kickAppAccessToken()
  const res = await fetch('https://api.kick.com/public/v1/events/subscriptions', {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) return existingIds
  const json = (await res.json()) as { data?: { id: string; broadcaster_user_id: number }[] }
  const have = new Set(
    (json.data ?? []).filter((s) => s.broadcaster_user_id === broadcasterUserId).map((s) => s.id),
  )
  if (have.size >= KICK_EVENT_NAMES.length) return [...have]
  const created = await createKickEventSubscriptions(broadcasterUserId)
  return [...new Set([...existingIds, ...created])]
}
