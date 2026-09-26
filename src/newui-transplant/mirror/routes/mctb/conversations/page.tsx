import { Inbox } from '@/newui-transplant/components/mctb/inbox'


export async function TransplantMctbConversationsPage({
  searchParams,
}: {
  searchParams: Promise<{ conversation?: string; filter?: string }>
}) {
  const { conversation, filter } = await searchParams
  return <Inbox initialId={conversation} initialFilter={filter === 'needs_reply' ? 'Needs reply' : 'All'} />
}
