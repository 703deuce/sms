import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Page, PageHeader } from '@/components/app/page-primitives'
import { StreamerOAuthButtons } from '@/components/streamer/streamer-oauth-buttons'
import { StreamerVodList } from '@/components/streamer/streamer-vod-list'
import { ChannelAutoProcessToggle } from '@/components/streamer/channel-auto-process'
import { streamerAutopullUiEnabled } from '@/lib/server/streamer/autopull-ui'
import { listStreamerChannels } from '@/lib/server/streamer/channels'
import { streamerPublicFlags } from '@/lib/server/streamer/env'
import { listStreamerIncomingForWorkspace } from '@/lib/server/streamer/vod-list'
import { resolveWorkspaceId } from '@/lib/server/workspace'
import { Radio } from 'lucide-react'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Auto-pull · Streamer' }

export default async function StreamerAutopullPage() {
  if (!streamerAutopullUiEnabled()) notFound()
  const workspaceId = await resolveWorkspaceId()
  const flags = streamerPublicFlags()
  const [channels, incoming] = await Promise.all([
    listStreamerChannels(workspaceId),
    listStreamerIncomingForWorkspace(workspaceId),
  ])

  return (
    <Page>
      <PageHeader
        icon={Radio}
        iconTone="brand"
        title="Auto-pull"
        description="Connect your Twitch or Kick channel. When a stream ends, we wait for the replay, pull audio, find moments, and clip highlights."
        meta={
          <Link href="/app/streamer" className="text-sm text-primary hover:underline">
            ← Streamer hub
          </Link>
        }
      />
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-8">
        <section className="space-y-3 rounded-lg border border-border p-4">
          <h2 className="text-sm font-semibold">Add a channel</h2>
          <p className="text-xs text-muted-foreground">
            OAuth proves the channel is yours. Auto-import only runs when the toggle below is on.
          </p>
          <StreamerOAuthButtons />
        </section>

        <section className="space-y-3 rounded-lg border border-border p-4">
          <h2 className="text-sm font-semibold">Connected channels</h2>
          {channels.length === 0 ? (
            <p className="text-sm text-muted-foreground">No channels yet. Connect Twitch or Kick above.</p>
          ) : (
            <ul className="space-y-4">
              {channels.map((ch) => (
                <li key={ch.id} className="rounded-md border border-border/60 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <Link href={`/app/streamer/channels/${ch.id}`} className="text-sm font-medium text-primary hover:underline">
                        {ch.displayName || ch.login}
                      </Link>
                      <p className="text-xs text-muted-foreground capitalize">
                        {ch.platform} · {ch.status}
                      </p>
                    </div>
                  </div>
                  {(flags.twitchOAuth && ch.platform === 'twitch') || (flags.kickOAuth && ch.platform === 'kick') ? (
                    <div className="mt-3">
                      <ChannelAutoProcessToggle
                        channelId={ch.id}
                        connected={ch.status === 'CONNECTED'}
                        initial={ch.autoProcess}
                      />
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-foreground">Incoming streams</h2>
          <p className="text-xs text-muted-foreground">
            Status updates as each VOD moves through replay wait, audio pull, moment finding, and clipping. You&apos;ll
            get a bell notification when clips are ready.
          </p>
          <StreamerVodList rows={incoming} showPipelineLabel />
        </section>
      </div>
    </Page>
  )
}
