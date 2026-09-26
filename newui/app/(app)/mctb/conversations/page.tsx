import type { Metadata } from 'next'
import { Inbox } from '@/components/mctb/inbox'

export const metadata: Metadata = { title: 'Inbox' }

export default async function ConversationsPage({
  searchParams,
}: {
  searchParams: Promise<{ conversation?: string; filter?: string }>
}) {
  const { conversation, filter } = await searchParams
  return <Inbox initialId={conversation} initialFilter={filter === 'needs_reply' ? 'Needs reply' : 'All'} />
}
