import { NextResponse } from 'next/server'
import { publicRedirectUrl } from '@/lib/integrations/framework/app-url'
import { verifyStreamerOAuthState } from '@/lib/server/streamer/oauth-state'
import {
  createTwitchEventsubSubscriptions,
  exchangeTwitchCode,
  twitchUsersMe,
  upsertTwitchConnection,
  twitchRedirectUri,
} from '@/lib/server/streamer/twitch'
import { getPrisma } from '@/lib/server/db'
import { checkTwitchChannelVodSaving } from '@/lib/server/streamer/vod-health'
import { mergePlatformState } from '@/lib/server/streamer/platform-state'
import type { Prisma } from '@prisma/client'

export async function GET(request: Request) {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  const err = url.searchParams.get('error')
  if (err) {
    return NextResponse.redirect(publicRedirectUrl('/app/streamer?oauth_error=twitch', request))
  }
  if (!code || !state) {
    return NextResponse.json({ error: 'Missing code' }, { status: 400 })
  }
  const parsed = verifyStreamerOAuthState(state)
  const tokens = await exchangeTwitchCode(code, twitchRedirectUri())
  const user = await twitchUsersMe(tokens.access_token)
  const { channel } = await upsertTwitchConnection(parsed.workspaceId, tokens, user)
  const subIds = await createTwitchEventsubSubscriptions(user.id)
  const prisma = getPrisma()
  const vodHealth = await checkTwitchChannelVodSaving(user.id, user.login)
  const existing = await prisma.streamChannel.findUnique({ where: { id: channel.id } })
  await prisma.streamChannel.update({
    where: { id: channel.id },
    data: {
      platformState: mergePlatformState(existing?.platformState, {
        eventsubIds: subIds,
        vodSaving: vodHealth,
      }) as Prisma.InputJsonValue,
    },
  })
  return NextResponse.redirect(publicRedirectUrl(`/app/streamer/channels/${channel.id}?connected=1`, request))
}
