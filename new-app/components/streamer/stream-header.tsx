import {
  vodChatHeaderLabel,
  type VodChatMeta,
} from '@/lib/streamer/vod-chat-status'

export function StreamHeader({
  platform,
  title,
  category,
  url,
  chatSource,
  chatMessages,
  chatError,
  chatMeta,
  projectStatus,
  sourceType,
}: {
  platform: string
  title?: string | null
  category?: string | null
  url?: string | null
  chatSource?: string | null
  chatMessages?: number | null
  chatError?: string | null
  chatMeta?: VodChatMeta | null
  projectStatus?: string | null
  sourceType?: string | null
}) {
  const chatLabelText = vodChatHeaderLabel({
    sourceType,
    chatSource,
    chatMessages,
    chatError,
    chatMeta,
    projectStatus,
  })

  return (
    <div className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm">
      <p className="font-medium capitalize">{platform} stream</p>
      {title ? <p className="text-muted-foreground">{title}</p> : null}
      {category ? <p className="text-xs text-muted-foreground">{category}</p> : null}
      <p className="mt-1 text-xs text-muted-foreground">{chatLabelText}</p>
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
