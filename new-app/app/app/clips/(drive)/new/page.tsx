import { Suspense } from 'react'
import { permanentRedirect } from 'next/navigation'
import { NewProjectWorkspace } from '@/components/clips/new-project-workspace'
import { clipperCapabilities } from '@/lib/server/clips/clipper-capabilities'
import { routes, withQuery } from '../../../../../lib/routes'

export const metadata = { title: 'New project · Clips' }

export default async function NewClipProjectPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const query = await searchParams
  const intent = query.intent
  const isFull = intent === 'full' || (Array.isArray(intent) && intent[0] === 'full')
  if (isFull) {
    const rest = { ...query }
    delete rest.intent
    permanentRedirect(withQuery(routes.videoEditorNew(), rest))
  }
  const { reframeV2Enabled } = clipperCapabilities()
  return (
    <Suspense fallback={<p className="p-6 text-sm text-muted-foreground">Loading…</p>}>
      <NewProjectWorkspace reframeV2Enabled={reframeV2Enabled} />
    </Suspense>
  )
}
