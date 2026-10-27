import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { publicRedirectUrl } from '@/lib/integrations/framework/app-url'
import { verifyStreamerOAuthState } from '@/lib/server/streamer/oauth-state'
import {
  createKickEventSubscriptions,
  exchangeKickCode,
  kickChannel,
  kickUser,
  upsertKickConnection,
} from '@/lib/server/streamer/kick'
import { mergePlatformState } from '@/lib/server/streamer/platform-state'
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
  let subIds: string[] = []
  try {
    subIds = await createKickEventSubscriptions(channel.broadcaster_user_id)
  } catch (err) {
    console.error('Kick event subscription create failed (will retry in maintenance):', err)
  }
  const prisma = getPrisma()
  const current = await prisma.streamChannel.findUnique({ where: { id: row.id }, select: { platformState: true } })
  await prisma.streamChannel.update({
    where: { id: row.id },
    data: {
      platformState: mergePlatformState(current?.platformState, {
        kickSubIds: subIds,
        kickSubscriptionsCheckedAt: new Date().toISOString(),
      }) as Prisma.InputJsonValue,
    },
  })
  const res = NextResponse.redirect(publicRedirectUrl(`/app/streamer/channels/${row.id}?connected=1`, request))
  res.cookies.delete('kick_pkce')
  return res
}
