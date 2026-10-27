import { Suspense } from 'react'
import { Page } from '@/components/app/page-primitives'
import { T2vCreateWorkspace } from '@/components/t2v/t2v-create-workspace'
import { isT2vFeatureEnabled } from '@/lib/features/t2v'
import { notFound } from 'next/navigation'

export const metadata = { title: 'AI Video · Clips' }

export default function T2vCreatePage() {
  if (!isT2vFeatureEnabled()) notFound()
  return (
    <Page>
      <Suspense fallback={<p className="p-6 text-sm text-muted-foreground">Loading…</p>}>
        <T2vCreateWorkspace />
      </Suspense>
    </Page>
  )
}
