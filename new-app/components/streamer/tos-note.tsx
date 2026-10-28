export function StreamerTosNote() {
  return (
    <p className="text-xs text-muted-foreground leading-relaxed">
      Only import streams you own or have permission to use. We download segments from Twitch/Kick archive VODs (including
      the in-progress archive while a stream is live), not a separate live capture, and delete the source after
      processing (clips are kept).
    </p>
  )
}
