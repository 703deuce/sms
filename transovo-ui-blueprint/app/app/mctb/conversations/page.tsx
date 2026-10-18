import { Page, PageHeader } from '@/components/app/page-primitives'
import { ThreadWorkspace } from '@/components/inbox/thread-workspace'

export const metadata = { title: 'Conversations · Missed Call Text Back' }

export default async function McTbConversations({ searchParams }: { searchParams: Promise<{ thread?: string }> }) {
  const { thread } = await searchParams
  return (
    <Page>
      <PageHeader title="Conversations" description="Text threads that started from a missed call. Replies here are sent from the line the caller dialed." />
      <ThreadWorkspace kind="mctb" initialId={thread} />
    </Page>
  )
}
