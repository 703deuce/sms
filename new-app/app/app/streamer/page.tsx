import { Page, PageHeader } from '@/components/app/page-primitives'
import { StreamerImportPanel } from '@/components/streamer/streamer-import-panel'
import { StreamerVodList } from '@/components/streamer/streamer-vod-list'
import { listStreamerVodsForWorkspace } from '@/lib/server/streamer/vod-list'
import { getStreamUsage } from '@/lib/server/streamer/usage'
import { resolveWorkspaceId } from '@/lib/server/workspace'
import { StreamerUsageMeter } from '@/components/streamer/usage-meter'
import { Radio } from 'lucide-react'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Streamer · Clips' }

export default async function StreamerHubPage() {
  const workspaceId = await resolveWorkspaceId()
  const [vods, usage] = await Promise.all([
    listStreamerVodsForWorkspace(workspaceId),
    getStreamUsage(workspaceId),
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
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-foreground">Your VOD imports</h2>
          <StreamerVodList rows={vods} />
        </div>
      </div>
    </Page>
  )
}
