import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Page, PageHeader } from '@/components/app/page-primitives'
import { ObsFallbackDocs } from '@/components/streamer/obs-fallback-docs'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { getPrisma } from '@/lib/server/db'
import { streamerPublicFlags } from '@/lib/server/streamer/env'
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
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={channel.autoProcess} disabled={channel.status !== 'CONNECTED'} />
            Auto-process when stream ends
          </label>
        </section>
        <ObsFallbackDocs />
      </div>
    </Page>
  )
}
