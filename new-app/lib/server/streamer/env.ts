import { getIntegrationAppUrl } from '@/lib/integrations/framework/app-url'
import { streamerAutopullUiEnabled } from '@/lib/server/streamer/autopull-ui'

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

/** Twitch growing archive ingest while live (stage 2; off by default). */
export function streamerTwitchRollingEnabled(): boolean {
  const raw = process.env.STREAMER_TWITCH_ROLLING_ENABLED?.trim().toLowerCase()
  return raw === '1' || raw === 'true' || raw === 'yes'
}

export function streamerPublicFlags() {
  const liveRealtime = streamerLiveRealtimeEnabled()
  return {
    twitchOAuth: streamerTwitchConfigured(),
    kickOAuth: streamerKickConfigured(),
    twitchWebhook: twitchWebhookUrl(),
    kickWebhook: kickWebhookUrl(),
    /** When false, UI shows live clipping as coming soon; webhooks skip live chat ingest. */
    liveRealtimeEnabled: liveRealtime,
    autopullUiEnabled: streamerAutopullUiEnabled(),
    twitchRollingEnabled: streamerTwitchRollingEnabled(),
    vodFirst: true,
  }
}
