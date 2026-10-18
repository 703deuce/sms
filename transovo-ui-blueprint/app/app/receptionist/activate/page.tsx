import { Page, PageHeader } from '@/components/app/page-primitives'
import { PublishReview } from '@/components/receptionist/publish-review'

export const metadata = { title: 'Review & Publish · AI Receptionist' }

export default function ActivatePage() {
  return (
    <Page>
      <PageHeader eyebrow="AI Receptionist" title="Review & publish" description="See exactly what changes, fix anything blocking, then make the draft live." />
      <PublishReview />
    </Page>
  )
}
