export type NearLiveSessionState = {
  projectId: string
  vodId: string
  /** Twitch archive video id from Helix */
  archiveVideoId?: string | null
  /** Ms of archive VOD already sent through the VOD pipeline */
  processedEndMs: number
  lastPollAt?: string | null
  streamStartedAt: string
  finalized?: boolean
}
