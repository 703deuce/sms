import Link from 'next/link'
import { Panel } from '@/components/app/page-primitives'
import { ProjectStatusBadge } from '@/components/app/status'
import { StreamerStageStepper } from '@/components/streamer/stage-stepper'
import type { StreamerVodRow } from '@/lib/server/streamer/vod-list'
import { ExternalLink } from 'lucide-react'

function formatEta(sec: number) {
  if (sec <= 0) return null
  if (sec < 90) return `~${sec}s`
  const min = Math.round(sec / 60)
  return min < 90 ? `~${min} min` : `~${Math.round(min / 60)}h`
}

export function StreamerVodList({ rows }: { rows: StreamerVodRow[] }) {
  if (!rows.length) {
    return (
      <Panel className="p-6 text-sm text-muted-foreground">
        No stream imports yet. Paste a finished Twitch or Kick VOD link above to start.
      </Panel>
    )
  }
  return (
    <div className="flex flex-col gap-3">
      {rows.map((row) => {
        const eta = formatEta(row.etaSec)
        const chunk =
          row.chunkDone != null && row.chunkTotal != null && row.chunkTotal > 0
            ? ` · chunk ${row.chunkDone}/${row.chunkTotal}`
            : ''
        return (
          <Panel key={row.vodId} className="p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    href={`/app/clips/${row.projectId}`}
                    className="truncate text-sm font-semibold text-foreground hover:underline"
                  >
                    {row.title}
                  </Link>
                  <ProjectStatusBadge status={row.status} />
                  <span className="text-xs capitalize text-muted-foreground">{row.platform}</span>
                </div>
                <StreamerStageStepper stage={row.stage} progress={row.progress} />
                {eta ? (
                  <p className="text-xs text-muted-foreground">
                    ETA {eta}
                    {chunk}
                  </p>
                ) : null}
              </div>
              {row.url ? (
                <a
                  href={row.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                >
                  Source <ExternalLink className="size-3" />
                </a>
              ) : null}
            </div>
          </Panel>
        )
      })}
    </div>
  )
}
