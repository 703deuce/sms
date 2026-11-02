import { Suspense } from 'react'
import { Page, PageHeader } from '@/components/app/page-primitives'
import { T2vCreateWorkspace } from '@/components/t2v/t2v-create-workspace'
import { requireAiVideoPageEnabled } from '@/lib/server/t2v/require-ai-video-page'

export const metadata = { title: 'AI Video · Clips' }

export default function T2vCreatePage() {
  requireAiVideoPageEnabled()
  return (
    <Page>
      <PageHeader
        title="AI Video"
        description="Turn an idea, script, link or document into a video"
      />
      <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
        <T2vCreateWorkspace />
      </Suspense>
    </Page>
  )
}
