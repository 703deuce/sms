export function StreamHeader({
  platform,
  title,
  category,
  url,
}: {
  platform: string
  title?: string | null
  category?: string | null
  url?: string | null
}) {
  return (
    <div className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm">
      <p className="font-medium capitalize">{platform} stream</p>
      {title ? <p className="text-muted-foreground">{title}</p> : null}
      {category ? <p className="text-xs text-muted-foreground">{category}</p> : null}
      {url ? (
        <a href={url} className="text-xs text-primary hover:underline" target="_blank" rel="noopener noreferrer">
          Open source
        </a>
      ) : null}
    </div>
  )
}
