import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { publicRedirectUrl } from '@/lib/integrations/framework/app-url'
import { verifyStreamerOAuthState } from '@/lib/server/streamer/oauth-state'
import { exchangeKickCode, kickChannel, kickUser, upsertKickConnection } from '@/lib/server/streamer/kick'
import { getPrisma } from '@/lib/server/db'

export async function GET(request: Request) {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  const verifier = (await cookies()).get('kick_pkce')?.value
  if (!code || !state || !verifier) {
    return NextResponse.json({ error: 'Missing OAuth parameters' }, { status: 400 })
  }
  const parsed = verifyStreamerOAuthState(state)
  const tokens = await exchangeKickCode(code, verifier)
  const user = await kickUser(tokens.access_token)
  const channel = await kickChannel(tokens.access_token)
  const { channel: row } = await upsertKickConnection(parsed.workspaceId, tokens, user, channel)
  const prisma = getPrisma()
  await prisma.streamChannel.update({
    where: { id: row.id },
    data: { platformState: { kickConnected: true } },
  })
  const res = NextResponse.redirect(publicRedirectUrl(`/app/streamer/channels/${row.id}?connected=1`, request))
  res.cookies.delete('kick_pkce')
  return res
}
