import { Suspense } from 'react'
import { NewProjectWorkspace } from '@/components/clips/new-project-workspace'

export const metadata = { title: 'New project · Clips' }

export default function NewClipProjectPage() {
  return (
    <Suspense fallback={<p className="p-6 text-sm text-muted-foreground">Loading…</p>}>
      <NewProjectWorkspace />
    </Suspense>
  )
}
