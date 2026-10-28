'use client'

import Link from 'next/link'

type RollingState = {
  live?: boolean
  chunkMin?: number
  lastPullCompletedAt?: string
  lastPullAt?: string
  lastPulledMs?: number
  stoppedReason?: string
}

function fmtWhen(iso?: string) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })
}

function nextPullEstimate(lastPullAt?: string, chunkMin?: number) {
  if (!lastPullAt || !chunkMin) return '—'
  const base = new Date(lastPullAt)
  if (Number.isNaN(base.getTime())) return '—'
  const next = new Date(base.getTime() + chunkMin * 60_000)
  if (next.getTime() <= Date.now()) return 'soon'
  return fmtWhen(next.toISOString())
}

export function ChannelLiveFollowStatus({
  platform,
  autoProcess,
  rollingEnabled,
  helixLive,
  rolling,
  projectId,
}: {
  platform: string
  autoProcess: boolean
  rollingEnabled: boolean
  helixLive: boolean
  rolling?: RollingState | null
  projectId?: string | null
}) {
  if (platform !== 'twitch' || !rollingEnabled) return null

  const sessionLive = Boolean(rolling?.live)
  const statusLabel = helixLive || sessionLive ? 'Live' : 'Offline'
  const statusClass =
    helixLive || sessionLive
      ? 'text-green-600 dark:text-green-400'
      : 'text-muted-foreground'

  return (
    <div className="space-y-2 rounded-md border border-border/70 bg-muted/20 p-3 text-xs">
      <p className="font-medium text-sm">Live auto-clip (rolling)</p>
      <p className="text-muted-foreground">
        While you are live on Twitch, we pull the newest minutes from your in-progress archive VOD every{' '}
        {rolling?.chunkMin ?? 12} minutes, find moments, and add clips to your feed.
      </p>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
        <dt className="text-muted-foreground">Platform</dt>
        <dd className={statusClass}>{statusLabel}</dd>
        <dt className="text-muted-foreground">Follow</dt>
        <dd>{autoProcess ? 'On (auto-process)' : 'Off'}</dd>
        <dt className="text-muted-foreground">Last pull</dt>
        <dd>{fmtWhen(rolling?.lastPullCompletedAt || rolling?.lastPullAt)}</dd>
        <dt className="text-muted-foreground">Next pull</dt>
        <dd>
          {autoProcess && (helixLive || sessionLive)
            ? nextPullEstimate(rolling?.lastPullAt, rolling?.chunkMin)
            : '—'}
        </dd>
      </dl>
      {rolling?.stoppedReason ? (
        <p className="text-muted-foreground">Session ended: {rolling.stoppedReason}</p>
      ) : null}
      {projectId ? (
        <Link href={`/app/clips/${projectId}`} className="text-primary hover:underline">
          View live session clips →
        </Link>
      ) : null}
    </div>
  )
}
