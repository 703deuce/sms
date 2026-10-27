import { Page } from '@/components/app/page-primitives'
import { isT2vFeatureEnabled } from '@/lib/features/t2v'
import { notFound } from 'next/navigation'

export const metadata = { title: 'Text to video · Clips' }

export default function T2vCreatePage() {
  if (!isT2vFeatureEnabled()) notFound()
  return (
    <Page>
      <div className="mx-auto max-w-2xl py-12 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Text to video</h1>
        <p className="mt-2 text-muted-foreground">Create flow ships in milestone M2 (FEATURE_T2V is on).</p>
      </div>
    </Page>
  )
}
