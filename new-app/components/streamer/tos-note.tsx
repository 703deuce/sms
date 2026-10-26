export function StreamerTosNote() {
  return (
    <p className="text-xs text-muted-foreground leading-relaxed">
      Only import streams you own or have permission to use. We fetch finished VODs and clips, never live streams,
      and delete the source after processing (clips are kept).
    </p>
  )
}
