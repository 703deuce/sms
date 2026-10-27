import 'server-only'
import { AccessToken, TrackSource, type VideoGrant } from 'livekit-server-sdk'
import { getLiveKitServerEnv } from '@/lib/server/livekit/env'

export type StudioRole = 'host' | 'guest' | 'producer'

export async function mintJoinToken(opts: {
  roomName: string
  identity: string
  displayName: string
  role: StudioRole
  sessionId: string
}): Promise<string> {
  const env = getLiveKitServerEnv()
  const at = new AccessToken(env.LIVEKIT_API_KEY, env.LIVEKIT_API_SECRET, {
    identity: opts.identity,
    name: opts.displayName,
    ttl: '10m',
    attributes: { role: opts.role, sessionId: opts.sessionId },
  })
  const grant: VideoGrant = {
    roomJoin: true,
    room: opts.roomName,
    canPublish: true,
    canSubscribe: true,
    canPublishData: true,
    canPublishSources: [
      TrackSource.CAMERA,
      TrackSource.MICROPHONE,
      TrackSource.SCREEN_SHARE,
      TrackSource.SCREEN_SHARE_AUDIO,
    ],
    canUpdateOwnMetadata: false,
  }
  at.addGrant(grant)
  return at.toJwt()
}
