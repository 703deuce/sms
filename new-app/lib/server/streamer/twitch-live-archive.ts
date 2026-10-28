import 'server-only'

export const TWITCH_LIVE_ARCHIVE_MATCH_MS = 10 * 60 * 1000

export const TWITCH_NO_LIVE_ARCHIVE_MSG =
  "This live stream doesn't have a saved broadcast yet (Twitch may not have published it). Try again in a few minutes."

export type TwitchArchiveCandidate = {
  id: string
  created_at: string
  duration: string
  live_status?: string | null
  stream_id?: string | null
}

export type TwitchLiveArchivePick = {
  video: TwitchArchiveCandidate
  reason: string
}

/** Pick the in-progress archive for a live broadcast (not a capped prior VOD). */
export function pickLiveTwitchArchive(
  rows: TwitchArchiveCandidate[],
  opts: {
    liveStreamId?: string
    streamStartedAt?: string
    ytdlpLiveStatusById?: Record<string, string | undefined>
  },
): TwitchLiveArchivePick | null {
  if (!rows.length) return null
  const { liveStreamId, streamStartedAt, ytdlpLiveStatusById } = opts

  if (liveStreamId) {
    const byStream = rows.find((v) => String(v.stream_id || '') === String(liveStreamId))
    if (byStream) return { video: byStream, reason: 'stream_id_match' }
  }

  if (ytdlpLiveStatusById) {
    for (const v of rows) {
      const st = (ytdlpLiveStatusById[v.id] || '').toLowerCase()
      if (st === 'is_live') return { video: v, reason: 'ytdlp_is_live' }
    }
  }

  if (streamStartedAt) {
    const target = Date.parse(streamStartedAt)
    if (!Number.isNaN(target)) {
      for (const v of rows) {
        const created = Date.parse(v.created_at)
        if (!Number.isNaN(created) && Math.abs(created - target) <= TWITCH_LIVE_ARCHIVE_MATCH_MS) {
          return { video: v, reason: 'created_at_near_stream_start' }
        }
      }
    }
  }

  return null
}

export function logArchiveResolveDecision(fields: {
  stream_started_at?: string | null
  candidates: TwitchArchiveCandidate[]
  picked?: string | null
  reason?: string | null
}) {
  const candidates = fields.candidates.map((c) => ({
    id: c.id,
    created_at: c.created_at,
    duration: c.duration,
    live_status: c.live_status ?? null,
    stream_id: c.stream_id ?? null,
  }))
  const rec = {
    ts: Date.now() / 1000,
    stage: 'stream_import',
    event: 'archive_resolve',
    stream_started_at: fields.stream_started_at ?? null,
    candidates,
    picked: fields.picked ?? null,
    reason: fields.reason ?? null,
  }
  console.info(`[clipper:decision] ${JSON.stringify(rec)}`)
}
