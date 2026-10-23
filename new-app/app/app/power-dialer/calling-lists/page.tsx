import { Page, PageHeader } from '@/components/app/page-primitives'
import { CallingListsWorkspace } from '@/components/power-dialer/calling-lists-workspace'

export const metadata = { title: 'Calling Lists · Power Dialer' }

export default function PowerDialerListsPage() {
  return (
    <Page>
      <PageHeader title="Calling lists" description="Import and maintain contact lists used by campaigns." />
      <CallingListsWorkspace />
    </Page>
  )
}
