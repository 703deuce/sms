import { NextResponse } from 'next/server'
import { createStreamerOAuthState } from '@/lib/server/streamer/oauth-state'
import { streamerTwitchConfigured } from '@/lib/server/streamer/env'
import { twitchAuthorizeUrl, twitchRedirectUri } from '@/lib/server/streamer/twitch'
import { resolveWorkspaceId } from '@/lib/server/workspace'

export async function GET() {
  if (!streamerTwitchConfigured()) {
    return NextResponse.json({ error: 'Twitch OAuth not configured' }, { status: 503 })
  }
  const workspaceId = await resolveWorkspaceId()
  const state = createStreamerOAuthState(workspaceId)
  const url = twitchAuthorizeUrl(state, twitchRedirectUri())
  return NextResponse.redirect(url)
}
