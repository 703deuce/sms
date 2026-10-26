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

export function streamerPublicFlags() {
  return {
    twitchOAuth: streamerTwitchConfigured(),
    kickOAuth: streamerKickConfigured(),
    twitchWebhook: twitchWebhookUrl(),
    kickWebhook: kickWebhookUrl(),
  }
}
