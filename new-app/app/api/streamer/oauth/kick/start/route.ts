import { NextResponse } from 'next/server'
import { createStreamerOAuthState } from '@/lib/server/streamer/oauth-state'
import { streamerKickConfigured } from '@/lib/server/streamer/env'
import { createKickPkceVerifier, kickAuthorizeUrl, kickCodeChallenge } from '@/lib/server/streamer/kick'
import { resolveWorkspaceId } from '@/lib/server/workspace'

export async function GET() {
  if (!streamerKickConfigured()) {
    return NextResponse.json({ error: 'Kick OAuth not configured' }, { status: 503 })
  }
  const workspaceId = await resolveWorkspaceId()
  const state = createStreamerOAuthState(workspaceId)
  const verifier = createKickPkceVerifier()
  const challenge = kickCodeChallenge(verifier)
  const url = kickAuthorizeUrl(state, challenge)
  const res = NextResponse.redirect(url)
  res.cookies.set('kick_pkce', verifier, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 600,
    path: '/',
  })
  return res
}
