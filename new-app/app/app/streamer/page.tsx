import { PageContainer, PageHeader } from '@/components/app/page-primitives'
import { StreamerImportPanel } from '@/components/streamer/streamer-import-panel'
import { ObsFallbackDocs } from '@/components/streamer/obs-fallback-docs'
import { StreamerVodList } from '@/components/streamer/streamer-vod-list'
import { listStreamerChannels } from '@/lib/server/streamer/channels'
import Link from 'next/link'
import { StreamerOAuthButtons } from '@/components/streamer/streamer-oauth-buttons'
import { listStreamerVodsForWorkspace } from '@/lib/server/streamer/vod-list'
import { getStreamUsage } from '@/lib/server/streamer/usage'
import { resolveWorkspaceId } from '@/lib/server/workspace'
import { StreamerUsageMeter } from '@/components/streamer/usage-meter'
import { StreamerLiveComingSoon } from '@/components/streamer/streamer-live-coming-soon'
import { streamerLiveRealtimeEnabled, streamerPublicFlags } from '@/lib/server/streamer/env'
import { Radio } from 'lucide-react'
import type { StreamerVodRow } from '../../../lib/server/streamer/vod-list'
import { StreamerUnifiedResults } from '../../../components/streamer/streamer-unified-results'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Streamer · Clips' }

export default async function StreamerHubPage() {
  const workspaceId = await resolveWorkspaceId()
  const flags = streamerPublicFlags()
  const queryStart = Date.now()
  const [vods, usage, channels] = await Promise.all([
    listStreamerVodsForWorkspace(workspaceId),
    getStreamUsage(workspaceId),
    listStreamerChannels(workspaceId),
  ])
  console.info('[page:timing]', { path: '/app/streamer', query: 'vods_usage_channels', elapsedMs: Date.now() - queryStart, rows: vods.length })
  const vodRows: StreamerVodRow[] = vods
  // Sign clips only when the grid mounts in the browser. The VOD list and
  // existing clip ranking remain unchanged, but SSR no longer waits on S3 URLs.
  console.info('[page:timing]', { path: '/app/streamer', query: 'clip_url_signing_deferred', elapsedMs: 0, rows: 0 })
  const processingVods: StreamerVodRow[] = vodRows.filter(
    (v: StreamerVodRow) => v.status !== 'READY' && v.status !== 'FAILED' && v.status !== 'CANCELED',
  )
  const failedVod: StreamerVodRow | undefined = vodRows.find((v: StreamerVodRow) => v.status === 'FAILED')
  return (
    <PageContainer className="max-w-none">
      <PageHeader
        icon={Radio}
        iconTone="brand"
        title="Streamer"
        description="VOD-first: import finished streams by link or upload. Chat replay and clip cues run on the recording after it is available."
      />
      <div className="grid gap-8 xl:grid-cols-[360px_minmax(0,1fr)]">
        <div className="flex flex-col gap-8">
          <StreamerUsageMeter initial={usage} />
          {!streamerLiveRealtimeEnabled() ? <StreamerLiveComingSoon /> : null}
          <StreamerImportPanel usageInitial={usage} />
          {flags.autopullUiEnabled ? (
            <section className="rounded-lg border border-border p-4">
              <Link href="/app/streamer/autopull" className="text-sm font-semibold text-primary hover:underline">
                Auto-pull settings & incoming streams →
              </Link>
              <p className="mt-1 text-xs text-muted-foreground">
                Connect Twitch/Kick, toggle auto-import, and track replay → clips status. Notifications appear in the bell
                when clips are ready.
              </p>
            </section>
          ) : null}
          <section className="space-y-3 rounded-lg border border-border p-4">
            <h2 className="text-sm font-semibold">Channels</h2>
            <StreamerOAuthButtons />
            <ul className="space-y-2 text-sm">
              {channels.map((ch) => (
                <li key={ch.id}>
                  <Link href={`/app/streamer/channels/${ch.id}`} className="text-primary hover:underline">
                    {ch.displayName || ch.login}
                  </Link>
                  <span className="text-muted-foreground">
                    {' '}
                    · {ch.platform} · {ch.status}
                  </span>
                </li>
              ))}
              {channels.length === 0 ? (
                <li className="text-muted-foreground">Connect a channel or paste a VOD below.</li>
              ) : null}
            </ul>
          </section>
          <ObsFallbackDocs />
        </div>
        <div className="min-w-0 space-y-6">
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-foreground">Your VOD imports</h2>
            <StreamerVodList rows={vods} />
          </div>
          <StreamerUnifiedResults
            clips={[]}
            loadAfterPaint
            fallbackProjectId={vods[0]?.projectId ?? ''}
            processing={processingVods.length > 0}
            failed={Boolean(failedVod)}
            error={failedVod?.error ?? null}
            retryProjectId={failedVod?.projectId ?? null}
            etaSec={processingVods[0]?.etaSec ?? 0}
            stage={processingVods[0]?.stage ?? null}
            clipsReady={0}
            clipsTotal={Math.max(0, processingVods.reduce((n: number, v: StreamerVodRow) => n + (v.chunkTotal ?? 0), 0))}
          />
        </div>
      </div>
    </PageContainer>
  )
}
