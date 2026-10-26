import { Badge } from '@/components/ui/badge'

export function StreamerLiveComingSoon({ compact = false }: { compact?: boolean }) {
  if (compact) {
    return (
      <Badge variant="secondary" className="text-[10px] font-normal">
        Live clipping — coming soon
      </Badge>
    )
  }
  return (
    <section className="rounded-lg border border-dashed border-border bg-muted/10 p-4 text-sm">
      <div className="mb-1 flex flex-wrap items-center gap-2">
        <h3 className="font-semibold text-foreground">Live clipping while you stream</h3>
        <Badge variant="secondary">Coming soon</Badge>
      </div>
      <p className="text-xs text-muted-foreground">
        Streamer v1 is VOD-first: paste a finished VOD, upload a recording, or turn on auto-import when your stream
        ends. Real-time highlight detection during a live broadcast is paused while we harden the after-stream path.
      </p>
    </section>
  )
}
