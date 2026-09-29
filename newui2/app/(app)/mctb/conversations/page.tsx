import type { Metadata } from 'next'
import { Suspense } from 'react'
import { PageHeader } from '@/components/app/primitives'
import { InboxView } from '@/components/mctb/inbox-view'

export const metadata: Metadata = { title: 'Inbox' }

export default function ConversationsPage() {
  return (
    <>
      <PageHeader title="Inbox" description="Text conversations started by missed-call recovery." />
      <Suspense fallback={<div className="h-[520px] animate-pulse rounded-xl border bg-muted/40" />}>
        <InboxView />
      </Suspense>
    </>
  )
}
