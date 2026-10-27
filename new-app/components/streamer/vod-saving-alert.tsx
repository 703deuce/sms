'use client'

import { useState } from 'react'
import { ExternalLink, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { VodAvailabilityView } from '@/lib/streamer/vod-availability'
import { clipsFetch } from '@/lib/clips-api'

export function VodSavingAlert({
  initial,
  channelId,
  onUpdate,
}: {
  initial?: VodAvailabilityView | null
  channelId?: string
  onUpdate?: (view: VodAvailabilityView) => void
}) {
  const [view, setView] = useState<VodAvailabilityView | null | undefined>(initial)
  const [busy, setBusy] = useState(false)

  if (!view || view.status === 'ok') return null

  const recheck = async () => {
    setBusy(true)
    try {
      if (channelId) {
        const data = await clipsFetch<VodAvailabilityView>(
          `/api/streamer/channels/${channelId}/vod-health`,
          { method: 'POST', body: '{}' },
        )
        setView(data)
        onUpdate?.(data)
      }
    } finally {
      setBusy(false)
    }
  }

  const tone =
    view.status === 'blocked'
      ? 'border-destructive/40 bg-destructive/5'
      : 'border-amber-500/40 bg-amber-500/5'

  return (
    <div className={`rounded-lg border p-3 text-sm ${tone}`}>
      <p className="font-medium">{view.fixTitle || 'VOD availability'}</p>
      <p className="mt-1 text-muted-foreground">{view.message}</p>
      {view.fixSteps?.length ? (
        <ol className="mt-2 list-decimal space-y-1 pl-4 text-xs text-muted-foreground">
          {view.fixSteps.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ol>
      ) : null}
      <div className="mt-3 flex flex-wrap gap-2">
        {view.dashboardUrl ? (
          <Button size="sm" variant="outline" render={<a href={view.dashboardUrl} target="_blank" rel="noreferrer" />} nativeButton={false}>
            <ExternalLink className="mr-1 size-3.5" />
            Open Twitch VOD settings
          </Button>
        ) : null}
        {channelId ? (
          <Button size="sm" variant="secondary" disabled={busy} onClick={() => void recheck()}>
            <RefreshCw className={`mr-1 size-3.5 ${busy ? 'animate-spin' : ''}`} />
            Re-check
          </Button>
        ) : null}
      </div>
    </div>
  )
}

export function VodUrlCheckBanner({
  view,
  onRecheck,
  rechecking,
}: {
  view: VodAvailabilityView | null
  onRecheck?: () => void
  rechecking?: boolean
}) {
  if (!view || view.status === 'ok') return null
  const tone =
    view.status === 'blocked'
      ? 'border-destructive/40 bg-destructive/5'
      : 'border-amber-500/40 bg-amber-500/5'
  return (
    <div className={`rounded-lg border p-3 text-xs ${tone}`}>
      <p className="font-medium">{view.fixTitle || 'Check this link'}</p>
      <p className="mt-1 text-muted-foreground">{view.message}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {view.dashboardUrl ? (
          <a
            href={view.dashboardUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center text-primary underline"
          >
            Turn on Store past broadcasts
            <ExternalLink className="ml-1 size-3" />
          </a>
        ) : null}
        {onRecheck ? (
          <button
            type="button"
            className="inline-flex items-center text-primary underline disabled:opacity-50"
            disabled={rechecking}
            onClick={onRecheck}
          >
            <RefreshCw className={`mr-1 size-3 ${rechecking ? 'animate-spin' : ''}`} />
            Re-check link
          </button>
        ) : null}
      </div>
    </div>
  )
}
