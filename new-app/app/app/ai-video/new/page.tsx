import { Suspense } from 'react'
import { Page, PageHeader } from '../../../../components/app/page-primitives'
import { T2vCreateWorkspace } from '../../../../components/t2v/t2v-create-workspace'
import { T2vPromptToVideo } from '../../../../components/t2v/t2v-prompt-to-video'
import { requireAiVideoPageEnabled } from '../../../../lib/server/t2v/require-ai-video-page'

export const metadata = { title: 'Text to Video' }

export default async function T2vCreatePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  requireAiVideoPageEnabled()
  const sp = await searchParams
  // Advanced (step-by-step) flow keeps its existing URLs: ?mode=advanced, ?d=<draft>, ?template=<id>.
  const advanced = sp.mode === 'advanced' || Boolean(sp.d) || Boolean(sp.template)
  return (
    <Page>
      <PageHeader
        title="Text to Video"
        description={
          advanced
            ? 'Turn an idea, script, link or document into a video'
            : 'Type an idea. Get a narrated, edited video with real stock footage.'
        }
      />
      <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
        {advanced ? <T2vCreateWorkspace /> : <T2vPromptToVideo />}
      </Suspense>
    </Page>
  )
}
