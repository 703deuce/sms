export type StreamPlatform = 'twitch' | 'kick'
export type StreamKind = 'vod' | 'highlight' | 'clip' | 'channel'

export type ParsedStreamUrl =
  | {
      platform: StreamPlatform
      kind: StreamKind
      id: string
      channel?: string
      startHintS?: number
    }
  | { error: string }

const KICK_BARE_CHANNEL_MSG =
  "That's a channel page. Paste a Kick replay (…/videos/…) or clip link."

const TWITCH_RESERVED = new Set([
  'directory',
  'downloads',
  'settings',
  'moderator',
  'inventory',
  'prime',
  'turbo',
  'friends',
  'bits',
  'subs',
  'support',
  'p',
  'popout',
])

function normalizeRaw(raw: string): URL | null {
  const trimmed = raw.trim()
  if (!trimmed) return null
  try {
    return new URL(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`)
  } catch {
    return null
  }
}

function parseTimeHint(url: URL): number | undefined {
  const t = url.searchParams.get('t')
  if (!t) return undefined
  const m = t.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/i)
  if (m) {
    const h = Number(m[1] || 0)
    const min = Number(m[2] || 0)
    const s = Number(m[3] || 0)
    return h * 3600 + min * 60 + s
  }
  if (/^\d+$/.test(t)) return Number(t)
  return undefined
}

export function parseStreamUrl(raw: string): ParsedStreamUrl {
  const url = normalizeRaw(raw)
  if (!url) return { error: 'unsupported' }

  const host = url.hostname.toLowerCase().replace(/^www\./, '').replace(/^m\./, '')
  const startHintS = parseTimeHint(url)
  const path = url.pathname.replace(/\/+$/, '')

  if (host === 'clips.twitch.tv') {
    const slug = path.split('/').filter(Boolean)[0]
    if (slug) return { platform: 'twitch', kind: 'clip', id: slug, startHintS }
  }

  if (host === 'twitch.tv') {
    const parts = path.split('/').filter(Boolean)
    if (parts[0] === 'videos' && parts[1] && /^\d+$/.test(parts[1])) {
      return { platform: 'twitch', kind: 'vod', id: parts[1], startHintS }
    }
    if (parts.length === 3 && parts[1] === 'video' && /^\d+$/.test(parts[2])) {
      return { platform: 'twitch', kind: 'vod', id: parts[2], channel: parts[0], startHintS }
    }
    if (parts.length === 3 && parts[1] === 'clip' && parts[2]) {
      return { platform: 'twitch', kind: 'clip', id: parts[2], channel: parts[0], startHintS }
    }
    if (parts.length === 1 && parts[0] && !TWITCH_RESERVED.has(parts[0].toLowerCase())) {
      return { platform: 'twitch', kind: 'channel', id: parts[0].toLowerCase(), channel: parts[0].toLowerCase() }
    }
  }

  if (host === 'kick.com') {
    const parts = path.split('/').filter(Boolean)
    const clipParam = url.searchParams.get('clip')
    if (parts.length === 1 && clipParam) {
      return { platform: 'kick', kind: 'clip', id: clipParam, channel: parts[0], startHintS }
    }
    if (parts.length === 3 && parts[1] === 'clips' && parts[2]) {
      return { platform: 'kick', kind: 'clip', id: parts[2], channel: parts[0], startHintS }
    }
    if (parts.length === 3 && parts[1] === 'videos' && parts[2]) {
      return { platform: 'kick', kind: 'vod', id: parts[2], channel: parts[0], startHintS }
    }
    if (parts[0] === 'video' && parts[1]) {
      return { platform: 'kick', kind: 'vod', id: parts[1], startHintS }
    }
    if (parts.length === 1 && parts[0]) {
      return { error: KICK_BARE_CHANNEL_MSG }
    }
  }

  return { error: 'unsupported' }
}

export function isStreamerImportUrl(raw: string): boolean {
  const p = parseStreamUrl(raw)
  return !('error' in p)
}
