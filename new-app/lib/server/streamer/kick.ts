import { createHash, randomBytes } from 'node:crypto'
import { encryptIntegrationSecret, decryptIntegrationSecret } from '@/lib/integrations/framework/secrets'
import { kickRedirectUri } from '@/lib/server/streamer/env'
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
