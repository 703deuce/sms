import { Page, PageHeader } from '@/components/app/page-primitives'
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
import { Radio } from 'lucide-react'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Streamer · Clips' }

export default async function StreamerHubPage() {
  const workspaceId = await resolveWorkspaceId()
  const [vods, usage, channels] = await Promise.all([
    listStreamerVodsForWorkspace(workspaceId),
    getStreamUsage(workspaceId),
    listStreamerChannels(workspaceId),
  ])
  return (
    <Page>
      <PageHeader
        icon={Radio}
        iconTone="brand"
        title="Streamer"
        description="Import finished Twitch or Kick VODs. We find highlight clips with chat and audio signals."
      />
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-8">
        <StreamerUsageMeter initial={usage} />
        <StreamerImportPanel usageInitial={usage} />
        <section className="space-y-3 rounded-lg border border-border p-4">
          <h2 className="text-sm font-semibold">Channels</h2>
          <StreamerOAuthButtons />
          <ul className="space-y-2 text-sm">
            {channels.map((ch) => (
              <li key={ch.id}>
                <Link href={`/app/streamer/channels/${ch.id}`} className="text-primary hover:underline">
                  {ch.displayName || ch.login}
                </Link>
                <span className="text-muted-foreground"> · {ch.platform} · {ch.status}</span>
              </li>
            ))}
            {channels.length === 0 ? <li className="text-muted-foreground">Connect a channel or paste a VOD below.</li> : null}
          </ul>
        </section>
        <ObsFallbackDocs />
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-foreground">Your VOD imports</h2>
          <StreamerVodList rows={vods} />
        </div>
      </div>
    </Page>
  )
}
