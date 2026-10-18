import { Page, PageHeader } from '@/components/app/page-primitives'
import { ThreadWorkspace } from '@/components/inbox/thread-workspace'

export const metadata = { title: 'Inbox' }

export default async function InboxPage({ searchParams }: { searchParams: Promise<{ thread?: string }> }) {
  const { thread } = await searchParams
  return (
    <Page>
      <PageHeader title="Inbox" description="Every text conversation across your lines — missed-call recoveries, AI follow-ups and direct messages." />
      <ThreadWorkspace initialId={thread} />
    </Page>
  )
}
