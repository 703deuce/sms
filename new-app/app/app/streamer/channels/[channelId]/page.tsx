import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Page, PageHeader } from '@/components/app/page-primitives'
import { ObsFallbackDocs } from '@/components/streamer/obs-fallback-docs'
import { Button } from '@/components/ui/button'
import { ChannelAutoProcessToggle } from '@/components/streamer/channel-auto-process'
import { VodSavingAlert } from '@/components/streamer/vod-saving-alert'
import type { VodAvailabilityView } from '@/lib/streamer/vod-availability'
import { StreamerLiveComingSoon } from '@/components/streamer/streamer-live-coming-soon'
import { getPrisma } from '@/lib/server/db'
import { streamerLiveRealtimeEnabled, streamerPublicFlags } from '@/lib/server/streamer/env'
import { resolveWorkspaceId } from '@/lib/server/workspace'

export default async function StreamerChannelPage({ params }: { params: Promise<{ channelId: string }> }) {
  const { channelId } = await params
  const workspaceId = await resolveWorkspaceId()
  const prisma = getPrisma()
  const channel = await prisma.streamChannel.findFirst({
    where: { id: channelId, workspaceId, deletedAt: null },
  })
  if (!channel) notFound()
  const flags = streamerPublicFlags()
  const ps = (channel.platformState as Record<string, unknown>) || {}
  const vodSaving = ps.vodSaving as VodAvailabilityView | undefined
  const skippedStreams = Array.isArray(ps.skippedStreams) ? ps.skippedStreams : []

  return (
    <Page>
      <PageHeader
        title={channel.displayName || channel.login}
        description={`${channel.platform} · ${channel.status}`}
        meta={
          <Link href="/app/streamer" className="text-sm text-primary hover:underline">
            ← Back to Streamer
          </Link>
        }
      />
      <div className="mx-auto flex max-w-2xl flex-col gap-6">
        <section className="space-y-3 rounded-lg border border-border p-4">
          <h2 className="text-sm font-semibold">Connection</h2>
          <p className="text-xs text-muted-foreground">
            We only process your own channel&apos;s finished VODs. We never record your live stream.
          </p>
          <div className="flex flex-wrap gap-2">
            {flags.twitchOAuth && channel.platform === 'twitch' && channel.status !== 'CONNECTED' ? (
              <Button size="sm" render={<a href="/api/streamer/oauth/twitch/start" />} nativeButton={false}>
                Connect Twitch
              </Button>
            ) : null}
            {flags.kickOAuth && channel.platform === 'kick' && channel.status !== 'CONNECTED' ? (
              <Button size="sm" render={<a href="/api/streamer/oauth/kick/start" />} nativeButton={false}>
                Connect Kick
              </Button>
            ) : null}
            {channel.status === 'CONNECTED' ? (
              <span className="text-sm text-green-600 dark:text-green-400">Connected</span>
            ) : null}
          </div>
          <ChannelAutoProcessToggle
            channelId={channel.id}
            connected={channel.status === 'CONNECTED'}
            initial={channel.autoProcess}
          />
          <VodSavingAlert initial={vodSaving} channelId={channel.id} />
        </section>
        {skippedStreams.length ? (
          <section className="space-y-2 rounded-lg border border-border p-4">
            <h2 className="text-sm font-semibold">Skipped streams</h2>
            <p className="text-xs text-muted-foreground">
              Auto-clip did not run — we always show why (never silent skips).
            </p>
            <ul className="max-h-48 space-y-2 overflow-y-auto text-xs">
              {skippedStreams.map((row: { at?: string; message?: string; title?: string }, i: number) => (
                <li key={`${row.at}-${i}`} className="rounded border border-border/60 p-2">
                  <p className="font-medium">{row.title || 'Stream'}</p>
                  <p className="text-muted-foreground">{row.message}</p>
                  {row.at ? <p className="mt-0.5 text-[10px] text-muted-foreground">{row.at}</p> : null}
                </li>
              ))}
            </ul>
          </section>
        ) : null}
        {!streamerLiveRealtimeEnabled() ? <StreamerLiveComingSoon /> : null}
        <ObsFallbackDocs />
      </div>
    </Page>
  )
}
