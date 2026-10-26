import { getIntegrationAppUrl } from '@/lib/integrations/framework/app-url'

export function streamerTwitchConfigured(): boolean {
  return Boolean(process.env.TWITCH_CLIENT_ID?.trim() && process.env.TWITCH_CLIENT_SECRET?.trim())
}

export function streamerKickConfigured(): boolean {
  return Boolean(process.env.KICK_CLIENT_ID?.trim() && process.env.KICK_CLIENT_SECRET?.trim())
}

export function twitchRedirectUri(): string {
  return `${getIntegrationAppUrl()}/api/streamer/oauth/twitch/callback`
}

export function kickRedirectUri(): string {
  return `${getIntegrationAppUrl()}/api/streamer/oauth/kick/callback`
}

export function twitchWebhookUrl(): string {
  return `${getIntegrationAppUrl()}/api/streamer/webhooks/twitch`
}

export function kickWebhookUrl(): string {
  return `${getIntegrationAppUrl()}/api/streamer/webhooks/kick`
}

/** S13/S14 live EventSub chat capture + live clipping (frozen for Streamer v1; VOD replay stays on). */
export function streamerLiveRealtimeEnabled(): boolean {
  const raw = process.env.STREAMER_LIVE_REALTIME_ENABLED?.trim().toLowerCase()
  return raw === '1' || raw === 'true' || raw === 'yes'
}

/**
 * Near-live: poll in-progress Twitch archive VOD during stream.online (no live HLS playback).
 * Distinct from STREAMER_LIVE_REALTIME_ENABLED.
 */
export function streamerNearLiveEnabled(): boolean {
  const raw = process.env.STREAMER_NEAR_LIVE_ENABLED?.trim().toLowerCase()
  return raw === '1' || raw === 'true' || raw === 'yes'
}

/** Live chat ingest for hype / !clip cues (near-live or legacy live realtime). */
export function streamerLiveChatIngestEnabled(): boolean {
  return streamerLiveRealtimeEnabled() || streamerNearLiveEnabled()
}

export function streamerPublicFlags() {
  const liveRealtime = streamerLiveRealtimeEnabled()
  const nearLive = streamerNearLiveEnabled()
  return {
    twitchOAuth: streamerTwitchConfigured(),
    kickOAuth: streamerKickConfigured(),
    twitchWebhook: twitchWebhookUrl(),
    kickWebhook: kickWebhookUrl(),
    /** When false, UI shows live clipping as coming soon; webhooks skip live chat ingest. */
    liveRealtimeEnabled: liveRealtime,
    nearLiveEnabled: nearLive,
    vodFirst: true,
  }
}
