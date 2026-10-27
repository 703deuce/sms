import { Suspense } from 'react'
import { NewProjectWorkspace } from '@/components/clips/new-project-workspace'
import { clipperCapabilities } from '@/lib/server/clips/clipper-capabilities'

export const metadata = { title: 'New project · Clips' }

export default function NewClipProjectPage() {
  const { reframeV2Enabled } = clipperCapabilities()
  return (
    <Suspense fallback={<p className="p-6 text-sm text-muted-foreground">Loading…</p>}>
      <NewProjectWorkspace reframeV2Enabled={reframeV2Enabled} />
    </Suspense>
  )
}
