import { Panel } from '@/components/app/page-primitives'
import { StreamerVodRowCard } from '@/components/streamer/streamer-vod-row'
import type { StreamerVodRow } from '@/lib/server/streamer/vod-list'

export function StreamerVodList({
  rows,
  showPipelineLabel = false,
}: {
  rows: StreamerVodRow[]
  showPipelineLabel?: boolean
}) {
  if (!rows.length) {
    return (
      <Panel className="p-6 text-sm text-muted-foreground">
        No stream imports yet. Paste a finished Twitch or Kick VOD link above to start.
      </Panel>
    )
  }
  return (
    <div className="flex flex-col gap-3">
      {rows.map((row) => (
        <StreamerVodRowCard key={row.vodId} row={row} showPipelineLabel={showPipelineLabel} />
      ))}
    </div>
  )
}
