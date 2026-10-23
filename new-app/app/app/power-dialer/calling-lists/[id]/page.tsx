import { Page } from '@/components/app/page-primitives'
import { ListDetailContent } from '@/components/power-dialer/list-detail-content'

export const metadata = { title: 'List detail · Power Dialer' }

export default async function PowerDialerListDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return (
    <Page>
      <ListDetailContent listId={id} />
    </Page>
  )
}
