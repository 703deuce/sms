function chatLabel(
  source: string | null | undefined,
  count: number | null | undefined,
  sourceType?: string | null,
) {
  if (sourceType === 'upload') {
    return 'Chat: No chat for uploaded files'
  }
  if (!source || source === 'none') {
    return 'Chat: unavailable (replay not configured or not supported for this source)'
  }
  if (source === 'kick_unavailable') {
    return 'Chat: unavailable (Kick VOD replay is not available for this source yet)'
  }
  const n = count ?? 0
  const via =
    source === 'twitch_replay' || source === 'twitch_gql'
      ? 'Twitch replay'
      : source === 'kick_replay'
        ? 'Kick replay'
        : source
  return `Chat: ${n.toLocaleString()} messages (${via})`
}

export function StreamHeader({
  platform,
  title,
  category,
  url,
  chatSource,
  chatMessages,
  chatError,
  sourceType,
}: {
  platform: string
  title?: string | null
  category?: string | null
  url?: string | null
  chatSource?: string | null
  chatMessages?: number | null
  chatError?: string | null
  sourceType?: string | null
}) {
  return (
    <div className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm">
      <p className="font-medium capitalize">{platform} stream</p>
      {title ? <p className="text-muted-foreground">{title}</p> : null}
      {category ? <p className="text-xs text-muted-foreground">{category}</p> : null}
      <p className="mt-1 text-xs text-muted-foreground">{chatLabel(chatSource, chatMessages, sourceType)}</p>
      {chatError ? (
        <p className="mt-1 text-xs text-amber-700 dark:text-amber-400" role="status">
          Chat replay failed: {chatError}
        </p>
      ) : null}
      {url ? (
        <a href={url} className="text-xs text-primary hover:underline" target="_blank" rel="noopener noreferrer">
          Open source
        </a>
      ) : null}
    </div>
  )
}
