export type ImportLinkKind = 'drive' | 'dropbox' | 'youtube' | 'twitch' | 'kick' | 'unsupported'

const YOUTUBE_HOSTS = new Set(['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtu.be', 'www.youtu.be'])

export const YOUTUBE_UNSUPPORTED_MSG =
  "YouTube links aren't supported yet, please upload the file."

export function classifyImportUrl(raw: string): ImportLinkKind {
  const trimmed = raw.trim()
  if (!trimmed) return 'unsupported'
  let url: URL
  try {
    url = new URL(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`)
  } catch {
    return 'unsupported'
  }
  const host = url.hostname.toLowerCase().replace(/^www\./, '')
  const hostWithWww = url.hostname.toLowerCase()
  if (YOUTUBE_HOSTS.has(hostWithWww) || host === 'youtu.be' || host === 'youtube.com') return 'youtube'
  if (host === 'drive.google.com' || host === 'docs.google.com') return 'drive'
  if (host === 'dropbox.com' || host.endsWith('.dropbox.com')) return 'dropbox'
  if (host === 'twitch.tv' || host === 'clips.twitch.tv' || hostWithWww === 'clips.twitch.tv') return 'twitch'
  if (host === 'kick.com') return 'kick'
  return 'unsupported'
}

export function parseGoogleDriveFileId(url: string): string | null {
  const trimmed = url.trim()
  try {
    const u = new URL(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`)
    const m = u.pathname.match(/\/file\/d\/([^/]+)/)
    if (m?.[1]) return m[1]
    const id = u.searchParams.get('id')
    if (id) return id
  } catch {
    return null
  }
  return null
}

export function normalizeDropboxShareUrl(url: string): string {
  const trimmed = url.trim()
  const u = new URL(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`)
  if (u.pathname.includes('/scl/')) {
    u.searchParams.set('raw', '1')
    u.searchParams.delete('dl')
  } else {
    u.searchParams.set('dl', '1')
  }
  return u.toString()
}

export function googleDriveDownloadUrl(fileId: string): string {
  return `https://drive.usercontent.google.com/download?id=${encodeURIComponent(fileId)}&export=download&confirm=t`
}

export function validateImportUrlForSubmit(raw: string): { ok: true; kind: 'drive' | 'dropbox' } | { ok: false; message: string } {
  const kind = classifyImportUrl(raw)
  if (kind === 'youtube') return { ok: false, message: YOUTUBE_UNSUPPORTED_MSG }
  if (kind === 'drive') {
    const id = parseGoogleDriveFileId(raw)
    if (!id) return { ok: false, message: 'Could not read Google Drive file id from this link.' }
    return { ok: true, kind: 'drive' }
  }
  if (kind === 'dropbox') return { ok: true, kind: 'dropbox' }
  if (kind === 'twitch' || kind === 'kick') {
    return {
      ok: false,
      message: 'Twitch and Kick links open in the Streamer tab — switch tabs to import.',
    }
  }
  return { ok: false, message: 'Only Google Drive and Dropbox share links are supported.' }
}
