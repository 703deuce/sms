/** Stream VOD availability codes + user-facing copy (Twitch paste + stage-2 channel connect). */

export type VodAvailabilityCode =
  | 'ok'
  | 'store_past_broadcasts_off'
  | 'no_archive_vods'
  | 'vod_deleted'
  | 'vod_private'
  | 'vod_sub_only'
  | 'vod_muted_copyright'
  | 'vod_unavailable'
  | 'kick_live_not_ready'
  | 'kick_replay_pending'
  | 'kick_no_replays'

export type VodAvailabilityStatus = 'ok' | 'warn' | 'blocked'

export type VodAvailabilityView = {
  status: VodAvailabilityStatus
  code: VodAvailabilityCode
  message: string
  fixTitle?: string
  fixSteps?: string[]
  dashboardUrl?: string
  checkedAt: string
  platform: 'twitch' | 'kick'
}

/** Twitch Creator Dashboard → Settings → Stream (VOD Settings / Store past broadcasts). */
export function twitchCreatorStreamSettingsUrl(login: string): string {
  const slug = login.trim().toLowerCase()
  return `https://dashboard.twitch.tv/u/${encodeURIComponent(slug)}/settings/stream`
}

export function vodAvailabilityMessage(code: VodAvailabilityCode): {
  status: VodAvailabilityStatus
  message: string
  fixTitle?: string
  fixSteps?: string[]
} {
  switch (code) {
    case 'ok':
      return { status: 'ok', message: 'VOD storage looks available for this channel.' }
    case 'store_past_broadcasts_off':
      return {
        status: 'blocked',
        message:
          'This Twitch channel has no saved past broadcasts. Auto-clip and VOD links need “Store past broadcasts” turned on.',
        fixTitle: 'Turn on Store past broadcasts',
        fixSteps: [
          'Open Twitch Creator Dashboard → Settings → Stream.',
          'Under VOD Settings, enable “Store past broadcasts”.',
          'Optional: enable “Always Publish VODs” so replays are public by default.',
          'Click Re-check below after saving.',
        ],
      }
    case 'no_archive_vods':
      return {
        status: 'warn',
        message:
          'We could not find any archive VODs on this channel. If you stream regularly, turn on Store past broadcasts or paste a direct VOD link.',
        fixTitle: 'Turn on Store past broadcasts',
        fixSteps: [
          'Creator Dashboard → Settings → Stream → VOD Settings → Store past broadcasts.',
        ],
      }
    case 'vod_deleted':
      return {
        status: 'blocked',
        message: 'This VOD was deleted or never existed. Paste a current VOD link or upload a recording.',
      }
    case 'vod_private':
      return {
        status: 'blocked',
        message:
          'This VOD is private or unpublished. Publish it in Video Producer, or upload a recording instead.',
      }
    case 'vod_sub_only':
      return {
        status: 'blocked',
        message:
          'This VOD is subscriber-only. Download it from your Twitch dashboard while logged in, then upload the file here.',
      }
    case 'vod_muted_copyright':
      return {
        status: 'blocked',
        message:
          'Twitch muted audio on this VOD (often copyright). Upload a local recording or pick another VOD without muted segments.',
      }
    case 'vod_unavailable':
      return {
        status: 'blocked',
        message: 'This VOD link is not available for import. Check the URL or upload a recording.',
      }
    case 'kick_live_not_ready':
      return {
        status: 'blocked',
        message:
          'Kick streams are clipped after the stream ends. Wait for the replay VOD on your channel, then paste that link.',
      }
    case 'kick_replay_pending':
      return {
        status: 'warn',
        message:
          'Kick replays usually appear within a few minutes after you go offline (we poll for up to ~90 minutes in auto mode).',
      }
    case 'kick_no_replays':
      return {
        status: 'warn',
        message:
          'No recent Kick replays found on this channel. Paste the replay link from kick.com/channel/videos after your next stream.',
      }
    default:
      return { status: 'warn', message: 'Could not verify VOD availability.' }
  }
}

export function buildVodAvailabilityView(
  platform: 'twitch' | 'kick',
  code: VodAvailabilityCode,
  login?: string,
): VodAvailabilityView {
  const base = vodAvailabilityMessage(code)
  const dashboardUrl =
    platform === 'twitch' && login && (code === 'store_past_broadcasts_off' || code === 'no_archive_vods')
      ? twitchCreatorStreamSettingsUrl(login)
      : undefined
  return {
    platform,
    code,
    status: base.status,
    message: base.message,
    fixTitle: base.fixTitle,
    fixSteps: base.fixSteps,
    dashboardUrl,
    checkedAt: new Date().toISOString(),
  }
}
