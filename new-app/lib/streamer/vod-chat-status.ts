export type VodChatMeta = {
  available?: boolean
  messageCount?: number
  source?: string | null
  error?: string | null
}

export type VodChatResolveInput = {
  sourceType?: string | null
  chatSource?: string | null
  chatMessages?: number | null
  chatError?: string | null
  chatMeta?: VodChatMeta | null
  projectStatus?: string | null
}

export type VodChatTriState = 'upload' | 'pending' | 'none' | 'available'

const TERMINAL_PROJECT_STATUSES = new Set(['READY', 'FAILED', 'CANCELED'])

/** True once analyze has finished (chat columns/meta should be settled). */
export function isPastVodChatAnalyze(projectStatus: string | null | undefined): boolean {
  return projectStatus != null && TERMINAL_PROJECT_STATUSES.has(projectStatus)
}

function chatViaLabel(source: string): string {
  if (source === 'twitch_replay' || source === 'twitch_gql') return 'Twitch replay'
  if (source === 'kick_replay') return 'Kick replay'
  return source
}

function resolvedFields(input: VodChatResolveInput): {
  source: string | null | undefined
  messageCount: number
  error: string | null | undefined
} {
  const meta = input.chatMeta
  const source =
    meta && meta.source != null && meta.source !== ''
      ? meta.source
      : input.chatSource
  const messageCount =
    typeof meta?.messageCount === 'number'
      ? meta.messageCount
      : typeof input.chatMessages === 'number'
        ? input.chatMessages
        : 0
  const error =
    (typeof meta?.error === 'string' && meta.error.trim() ? meta.error : null) ??
    (typeof input.chatError === 'string' && input.chatError.trim() ? input.chatError : null) ??
    undefined
  return { source, messageCount, error }
}

export function resolveVodChatTriState(input: VodChatResolveInput): VodChatTriState {
  if (input.sourceType === 'upload') return 'upload'

  const { source, messageCount, error } = resolvedFields(input)
  const metaAvailable = input.chatMeta?.available === true

  if (source == null || source === '') {
    return isPastVodChatAnalyze(input.projectStatus) ? 'none' : 'pending'
  }

  if (source === 'none') return 'none'
  if (source === 'kick_unavailable') return 'none'

  if (metaAvailable || messageCount > 0) return 'available'

  return 'none'
}

export function vodChatOverlayEnabled(input: VodChatResolveInput): boolean {
  return resolveVodChatTriState(input) === 'available'
}

export function vodChatHeaderLabel(input: VodChatResolveInput): string {
  if (input.sourceType === 'upload') {
    return 'Chat: No chat for uploaded files'
  }

  const state = resolveVodChatTriState(input)
  const { source, messageCount, error } = resolvedFields(input)

  if (state === 'pending') {
    return 'Chat: loading after analysis'
  }

  if (state === 'none') {
    if (source === 'kick_unavailable') {
      return 'Chat: unavailable (Kick VOD replay is not available for this source yet)'
    }
    const base =
      'Chat: unavailable (replay not configured or not supported for this source)'
    if (error) return `${base} — ${error}`
    return base
  }

  const via = chatViaLabel(String(source))
  return `Chat: ${messageCount.toLocaleString()} messages (${via})`
}

export function vodChatToggleHint(input: VodChatResolveInput): string | undefined {
  const state = resolveVodChatTriState(input)
  if (state === 'pending') return 'Chat loads after VOD analysis finishes'
  if (state === 'none') return 'No chat for this clip'
  return undefined
}
